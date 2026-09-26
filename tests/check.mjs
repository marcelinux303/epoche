import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const model = vm.createContext({});
vm.runInContext(read("PulseModel.js"), model, { filename: "PulseModel.js" });

for (const bad of [null, undefined, true, false, {}, [], "", " ", "abc", Infinity, NaN]) {
  assert.equal(model.validateInterval(bad), null);
  assert.equal(model.settingsFor({ intervalMinutes: bad }).intervalMinutes, 45);
  assert.equal(model.intervalMs(bad), 2700000);
}
for (const [input, expected] of [[0, 1], [-8, 1], [1, 1], ["60", 60], [" 60 ", 60], [1.6, 2], [1440, 1440], [5000, 1440]]) {
  assert.equal(model.validateInterval(input), expected);
  assert.equal(model.settingsFor({ intervalMinutes: input }).intervalMinutes, expected);
  assert.equal(model.intervalMs(input), expected * 60000);
}
assert.equal(model.settingsFor(null).intervalMinutes, 45);

let lastDuration = 0;
for (let n = 0; n <= 1000; n++) {
  const duration = model.durationFor("x".repeat(n));
  assert.ok(duration >= 5000 && duration <= 12000 && duration >= lastDuration);
  lastDuration = duration;
}
assert.equal(model.durationFor(null), 5000);

const id = "io.github.marcelinux303.epoche";
const entry = { id, intervalMinutes: 45, custom: { preserve: true } };
const updated = model.updatedEntry(entry, id, "60");
assert.equal(updated.intervalMinutes, 60);
assert.equal(updated.custom.preserve, true);
assert.equal(entry.intervalMinutes, 45);
assert.equal(model.updatedEntry(entry, id, "bad"), null);
assert.equal(model.updatedEntry(null, id, 60), null);
assert.equal(model.entryFor("{", id), null);
assert.equal(model.entryFor(JSON.stringify({ version: 1, plugins: [] }), id), null);
assert.equal(model.entryFor(JSON.stringify({ version: 1, plugins: [entry] }), id).intervalMinutes, 45);

const manifest = JSON.parse(read("manifest.json"));
assert.deepEqual(Object.keys(manifest).sort(), [
  "schemaVersion", "id", "name", "version", "author", "license",
  "description", "kinds", "keepLoaded", "entryPoints"
].sort());
assert.equal(manifest.id, id);
assert.deepEqual(manifest.kinds, ["panel"]);
assert.equal(manifest.keepLoaded, true);
assert.deepEqual(manifest.entryPoints, { panel: "Pulse.qml" });

for (const file of ["Pulse.qml", "PulseCard.qml", "PulseModel.js"]) {
  const source = read(file);
  assert.doesNotMatch(source, /\bProcess\b|\bexec\w*\s*\(|notify-send|systemd|XMLHttpRequest|\bfetch\s*\(|WebSocket|https?:\/\/|Quickshell\.Networking|Qt\.openUrlExternally/i, file);
}

console.log("OK — interval, duration, settings, manifest and offline runtime guards.");
await import("./v1-model.mjs");
await import("./v1-lifecycle.mjs");
await import("./v1-ui.mjs");
