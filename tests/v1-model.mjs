import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const model = vm.createContext({});
vm.runInContext(read("PulseModel.js"), model, { filename: "PulseModel.js" });

const enRaw = read("share/thoughts/en.json");
const frRaw = read("share/thoughts/fr.json");
const enDoc = JSON.parse(enRaw);
const frDoc = JSON.parse(frRaw);

assert.equal(enDoc.schemaVersion, 1);
assert.equal(enDoc.language, "en");
assert.equal(frDoc.schemaVersion, 1);
assert.equal(frDoc.language, "fr");
assert.ok(enDoc.thoughts.length >= 68 && enDoc.thoughts.length <= 75);
assert.equal(frDoc.thoughts.length, enDoc.thoughts.length);

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ids = new Set();
const categoryCounts = { DEV: 0, SYS: 0, AI: 0 };
const normalizedEnglish = new Set();
for (const thought of enDoc.thoughts) {
  assert.match(thought.id, idPattern);
  assert.ok(thought.id.length <= 48);
  assert.ok(!ids.has(thought.id), `duplicate id: ${thought.id}`);
  ids.add(thought.id);
  assert.ok(Object.hasOwn(categoryCounts, thought.category));
  categoryCounts[thought.category]++;
  assert.equal(typeof thought.text, "string");
  assert.equal(thought.text, thought.text.normalize("NFC"));
  assert.ok(thought.text.trim().length > 0 && thought.text.length <= 160);
  assert.doesNotMatch(thought.text, /[\u0000-\u001f\u007f]/);
  const key = thought.text.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ").trim();
  assert.ok(!normalizedEnglish.has(key), `duplicate English text: ${thought.id}`);
  normalizedEnglish.add(key);
}
assert.deepEqual(categoryCounts, { DEV: 24, SYS: 24, AI: 24 });

const frIds = new Set();
const normalizedFrench = new Set();
for (const thought of frDoc.thoughts) {
  assert.match(thought.id, idPattern);
  assert.ok(!frIds.has(thought.id), `duplicate FR id: ${thought.id}`);
  frIds.add(thought.id);
  assert.deepEqual(Object.keys(thought).sort(), ["id", "text"]);
  assert.equal(typeof thought.text, "string");
  assert.equal(thought.text, thought.text.normalize("NFC"));
  assert.ok(thought.text.trim().length > 0 && thought.text.length <= 200);
  assert.doesNotMatch(thought.text, /[\u0000-\u001f\u007f]/);
  const key = thought.text.toLocaleLowerCase("fr").replace(/[^a-z0-9àâçéèêëîïôùûüÿœæ]+/g, " ").trim();
  assert.ok(!normalizedFrench.has(key), `duplicate French text: ${thought.id}`);
  normalizedFrench.add(key);
}
assert.deepEqual([...frIds].sort(), [...ids].sort());

const canonical = model.parseCanonicalCatalog(enRaw);
assert.equal(canonical.length, 72);
assert.deepEqual(Object.keys(canonical[0]).sort(), ["category", "id", "text"]);
assert.equal(model.parseCanonicalCatalog("{}").length, 0);
assert.equal(model.parseCanonicalCatalog("{").length, 0);
assert.equal(model.parseCanonicalCatalog(JSON.stringify({ ...enDoc, language: "fr" })).length, 0);
assert.equal(model.parseCanonicalCatalog(JSON.stringify({ ...enDoc, thoughts: [...enDoc.thoughts, enDoc.thoughts[0]] })).length, 0);

const translation = model.parseTranslationCatalog(frRaw, "fr");
assert.equal(Object.keys(translation).length, 72);
assert.equal(Object.keys(model.parseTranslationCatalog("{}", "fr")).length, 0);
assert.equal(Object.keys(model.parseTranslationCatalog(JSON.stringify({ ...frDoc, language: "en" }), "fr")).length, 0);

const english = model.localizeCatalog(canonical, null, "en");
const french = model.localizeCatalog(canonical, translation, "fr");
assert.equal(english.length, 72);
assert.equal(french.length, 72);
assert.equal(english[0].id, french[0].id);
assert.equal(english[0].category, french[0].category);
assert.notEqual(english[0].text, french[0].text);

// Per-ID French corruption falls back to the matching English concept.
const incomplete = { ...translation };
delete incomplete[canonical[3].id];
const fallback = model.localizeCatalog(canonical, incomplete, "fr");
assert.equal(fallback[3].id, canonical[3].id);
assert.equal(fallback[3].text, canonical[3].text);
assert.equal(fallback[4].text, translation[canonical[4].id]);
// Whole-catalog failure also falls back to English without unrelated selection.
assert.deepEqual(model.localizeCatalog(canonical, {}, "fr"), english);

for (const [tag, expected] of [
  ["fr-FR", "fr"], ["fr_CA", "fr"], ["fr_FR.UTF-8", "fr"],
  ["en-US", "en"], ["EN_gb", "en"], ["de-DE", "de"], ["", ""]
]) assert.equal(model.normalizeLanguageTag(tag), expected);

assert.equal(model.resolveLanguage("fr", ["en-US"], "en_US"), "fr");
assert.equal(model.resolveLanguage("en", ["fr-FR"], "fr_FR"), "en");
assert.equal(model.resolveLanguage("auto", ["de-DE", "fr-CA", "en-US"], "de_DE"), "fr");
assert.equal(model.resolveLanguage("auto", ["de-DE", "es-ES"], "fr_FR"), "fr");
assert.equal(model.resolveLanguage("auto", ["de-DE"], "de_DE"), "en");
assert.equal(model.resolveLanguage("invalid", ["fr-FR"], "fr_FR"), "en");
for (const value of ["auto", "en", "fr"]) assert.equal(model.validateLanguagePreference(value), value);
for (const value of ["de", "", null, 42]) assert.equal(model.validateLanguagePreference(value), null);

// Semantic identity survives a language switch; no-repeat excludes the same ID.
const priorId = english[11].id;
const priorFrenchIndex = model.indexForId(french, priorId);
assert.equal(french[priorFrenchIndex].id, priorId);
for (const random of [0, 0.1, 0.5, 0.999999]) {
  const next = model.pickNext(french, priorFrenchIndex, random);
  assert.notEqual(french[next].id, priorId);
}
assert.equal(model.indexForId(french, "missing-id"), -1);
assert.equal(model.pickNext([], -1, 0.5), -1);
assert.equal(model.pickNext([english[0]], 0, 0.5), 0);

console.log(`OK — V1 bilingual catalogs (${canonical.length}), locale resolution, fallback and no-repeat.`);
