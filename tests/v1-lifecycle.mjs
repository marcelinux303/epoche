import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const qml = read("Pulse.qml");

function qmlMethod(name) {
  const start = qml.indexOf("function " + name + "(");
  assert.ok(start >= 0, `missing ${name}`);
  let end = qml.indexOf("{", start), depth = 1;
  for (end++; depth; end++) {
    if (qml[end] === "{") depth++;
    if (qml[end] === "}") depth--;
  }
  return qml.slice(start, end);
}

let appearStarts = 0;
let disappearStarts = 0;
let hideStops = 0;
const deferred = [];
const firstScreen = { name: "one" };
const focusedScreen = { name: "two" };
const state = vm.createContext({
  console,
  Quickshell: { screens: [firstScreen, focusedScreen] },
  Hyprland: { focusedMonitor: { name: "two" } },
  Qt: {
    callLater(callback) { deferred.push(callback); },
    locale() { return { uiLanguages: ["fr"], name: "fr_FR" }; }
  },
  shell: {}, manifest: {}, configReady: true,
  ready: true, canRun: true, canonicalReady: true, translationReady: true,
  corpus: [
    { id: "one", category: "DEV", text: "one" },
    { id: "two", category: "SYS", text: "two" },
    { id: "three", category: "AI", text: "three" }
  ],
  canonicalCorpus: [
    { id: "one", category: "DEV", text: "one" },
    { id: "two", category: "SYS", text: "two" },
    { id: "three", category: "AI", text: "three" }
  ],
  frenchTranslations: { one: "fr-one", two: "fr-two", three: "fr-three" },
  languagePreference: "en", effectiveLanguage: "en",
  previousIndex: -1, currentPulse: null, pendingPulse: null,
  pendingOpen: false, opened: false, targetScreen: null,
  windowActive: false, phase: "IDLE", generation: 0, transitionGeneration: 0,
  card: { surfaceOpacity: 0, contentOpacity: 0, marksOpacity: 0, revealProgress: 0 },
  hideTimer: { stop() { hideStops++; } },
  appearAnimation: { start() { appearStarts++; }, stop() {} },
  disappearAnimation: { start() { disappearStarts++; }, stop() {} }
});
state.root = state;
vm.runInContext("Math.random = function () { return 0.4; };", state);
vm.runInContext(read("PulseModel.js"), state, { filename: "PulseModel.js" });
state.PulseModel = {
  pickNext: state.pickNext,
  indexForId: state.indexForId,
  resolveLanguage: state.resolveLanguage,
  localizeCatalog: state.localizeCatalog,
  validateLanguagePreference: state.validateLanguagePreference
};
for (const name of ["selectScreen", "rebuildCorpus", "close", "showPulse", "applyPending", "beginAppear", "beginDisappear", "finishDisappear", "setLanguage"])
  vm.runInContext(qmlMethod(name), state);

assert.equal(state.selectScreen(), focusedScreen);
state.showPulse();
assert.equal(state.opened, true);
assert.equal(state.targetScreen, focusedScreen);
assert.equal(state.windowActive, true);
assert.equal(state.phase, "MEASURING");
assert.equal(state.pendingPulse, null);
assert.equal(deferred.length, 1);
deferred.shift()();
assert.equal(state.phase, "APPEAR");
assert.equal(appearStarts, 1);

state.card.surfaceOpacity = 1;
state.card.contentOpacity = 1;
state.card.marksOpacity = 1;
const firstVisibleId = state.currentPulse.id;
state.showPulse();
state.showPulse();
const latestId = state.pendingPulse.id;
assert.notEqual(firstVisibleId, latestId, "rapid summon must not reselect visible thought");
assert.equal(state.setLanguage("fr"), "ok");
assert.equal(state.pendingPulse.id, latestId);
assert.equal(state.pendingPulse.text, `fr-${latestId}`, "pending replacement must use new language");
assert.equal(state.phase, "DISAPPEAR");
assert.equal(disappearStarts, 2);
state.finishDisappear();
assert.equal(state.currentPulse.id, latestId);
assert.equal(state.currentPulse.text, `fr-${latestId}`);
assert.equal(state.pendingPulse, null);
assert.equal(state.phase, "MEASURING");
assert.equal(state.setLanguage("en"), "ok");
assert.equal(state.currentPulse.text, latestId, "MEASURING content must follow language change");
assert.equal(deferred.length, 1);

const staleDeferred = deferred.shift();
const generationBeforeClose = state.generation;
state.close();
assert.equal(state.generation, generationBeforeClose + 1);
assert.equal(state.opened, false);
assert.equal(state.pendingPulse, null);
assert.equal(state.phase, "DISAPPEAR");
staleDeferred();
assert.equal(appearStarts, 1, "stale deferred callback must not reopen");
state.finishDisappear();
assert.equal(state.phase, "IDLE");
assert.equal(state.windowActive, false);

state.Quickshell.screens = [];
state.showPulse();
assert.equal(state.pendingOpen, true);
assert.equal(state.opened, false);
assert.equal(state.windowActive, false);
assert.ok(hideStops > 0);
state.Quickshell.screens = [firstScreen];
state.Hyprland.focusedMonitor = null;
assert.equal(state.selectScreen(), firstScreen);

console.log("OK — V1 lifecycle coalescing, generation invalidation, close precedence and screen fallback.");
