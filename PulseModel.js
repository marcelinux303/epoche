// Shared verbatim by QML and the hermetic Node VM tests.
var supportedLanguages = ["en", "fr"];
var validCategories = ["DEV", "SYS", "AI"];
var thoughtIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
var controlCharacters = /[\u0000-\u001f\u007f]/;

function isNfcText(value) {
  return typeof value === "string" && value === value.normalize("NFC");
}

function validateCanonicalCatalog(value) {
  if (!value || value.schemaVersion !== 1 || value.language !== "en"
      || !Array.isArray(value.thoughts) || !value.thoughts.length) return [];
  var ids = Object.create(null);
  var texts = Object.create(null);
  var result = [];
  for (var i = 0; i < value.thoughts.length; i++) {
    var entry = value.thoughts[i];
    if (!entry || typeof entry.id !== "string" || !thoughtIdPattern.test(entry.id)
        || entry.id.length > 48 || ids[entry.id]
        || validCategories.indexOf(entry.category) < 0
        || !isNfcText(entry.text) || !entry.text.trim() || entry.text.length > 160
        || controlCharacters.test(entry.text) || texts[entry.text]) return [];
    ids[entry.id] = true;
    texts[entry.text] = true;
    result.push({ id: entry.id, category: entry.category, text: entry.text });
  }
  return result;
}

function parseCanonicalCatalog(raw) {
  try { return validateCanonicalCatalog(JSON.parse(raw)); } catch (error) { return []; }
}

function validateTranslationCatalog(value, expectedLanguage) {
  if (!value || value.schemaVersion !== 1 || value.language !== expectedLanguage
      || !Array.isArray(value.thoughts) || !value.thoughts.length) return {};
  var result = Object.create(null);
  var texts = Object.create(null);
  for (var i = 0; i < value.thoughts.length; i++) {
    var entry = value.thoughts[i];
    if (!entry || typeof entry.id !== "string" || !thoughtIdPattern.test(entry.id)
        || entry.id.length > 48 || result[entry.id] !== undefined
        || !isNfcText(entry.text) || !entry.text.trim() || entry.text.length > 200
        || controlCharacters.test(entry.text) || texts[entry.text]) return {};
    result[entry.id] = entry.text;
    texts[entry.text] = true;
  }
  return result;
}

function parseTranslationCatalog(raw, expectedLanguage) {
  try { return validateTranslationCatalog(JSON.parse(raw), expectedLanguage); }
  catch (error) { return {}; }
}

function localizeCatalog(canonical, translation, language) {
  if (!Array.isArray(canonical) || !canonical.length) return [];
  var useTranslation = language === "fr" && translation
      && typeof translation === "object" && Object.keys(translation).length > 0;
  var result = [];
  for (var i = 0; i < canonical.length; i++) {
    var source = canonical[i];
    var translated = useTranslation && typeof translation[source.id] === "string"
        && translation[source.id].trim() ? translation[source.id] : source.text;
    result.push({ id: source.id, category: source.category, text: translated });
  }
  return result;
}

function validateLanguagePreference(value) {
  if (typeof value !== "string") return null;
  var normalized = value.trim().toLowerCase();
  return ["auto", "en", "fr"].indexOf(normalized) >= 0 ? normalized : null;
}

function normalizeLanguageTag(value) {
  if (typeof value !== "string") return "";
  var normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  normalized = normalized.split(".")[0].split("@")[0].replace(/_/g, "-");
  return normalized.split("-")[0];
}

function resolveLanguage(preference, uiLanguages, localeName) {
  var requested = validateLanguagePreference(preference);
  if (requested === "en" || requested === "fr") return requested;
  if (requested !== "auto") return "en";
  var candidates = Array.isArray(uiLanguages) ? uiLanguages : [];
  for (var i = 0; i < candidates.length; i++) {
    var language = normalizeLanguageTag(candidates[i]);
    if (supportedLanguages.indexOf(language) >= 0) return language;
  }
  var localeLanguage = normalizeLanguageTag(localeName);
  return supportedLanguages.indexOf(localeLanguage) >= 0 ? localeLanguage : "en";
}

function indexForId(entries, id) {
  if (!Array.isArray(entries)) return -1;
  for (var i = 0; i < entries.length; i++) if (entries[i] && entries[i].id === id) return i;
  return -1;
}

function validateInterval(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  var n = Number(value);
  if (!isFinite(n)) return null;
  return Math.max(1, Math.min(1440, Math.round(n)));
}

function settingsFor(entry) {
  var minutes = validateInterval(entry && entry.intervalMinutes);
  return { intervalMinutes: minutes === null ? 45 : minutes };
}

function entryFor(raw, id) {
  try {
    var config = JSON.parse(raw);
    if (config.version !== 1 || !Array.isArray(config.plugins)) return null;
    for (var i = 0; i < config.plugins.length; i++) {
      var entry = config.plugins[i];
      if (entry && entry.id === id) return entry;
    }
  } catch (error) {}
  return null;
}

function updatedEntry(entry, id, minutes) {
  var value = validateInterval(minutes);
  if (!entry || entry.id !== id || value === null) return null;
  var result = JSON.parse(JSON.stringify(entry));
  result.id = id;
  result.intervalMinutes = value;
  return result;
}

function pickNext(entries, previous, randomValue) {
  var count = entries.length;
  if (!count) return -1;
  if (count === 1) return 0;
  var skip = Number.isInteger(previous) && previous >= 0 && previous < count;
  var random = typeof randomValue === "number" && isFinite(randomValue) ? randomValue : 0;
  random = Math.max(0, Math.min(0.9999999999999999, random));
  var index = Math.floor(random * (count - (skip ? 1 : 0)));
  return skip && index >= previous ? index + 1 : index;
}

function durationFor(text) {
  return Math.max(5000, Math.min(12000, 2500 + String(text || "").length * 45));
}

function intervalMs(minutes) {
  var value = validateInterval(minutes);
  return (value === null ? 45 : value) * 60000;
}
