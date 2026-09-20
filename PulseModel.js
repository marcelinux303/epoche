// Shared verbatim by QML and the hermetic Node VM tests.
function validateCorpus(value) {
  if (!Array.isArray(value)) return [];
  var seen = Object.create(null);
  var result = [];
  for (var i = 0; i < value.length; i++) {
    var entry = value[i];
    if (!entry || ["DEV", "SYS", "AI"].indexOf(entry.category) < 0
        || typeof entry.text !== "string" || !entry.text.trim()
        || entry.text.length > 200 || seen[entry.text]) return [];
    seen[entry.text] = true;
    result.push({ category: entry.category, text: entry.text });
  }
  return result;
}

function parseCorpus(raw) {
  try { return validateCorpus(JSON.parse(raw)); } catch (error) { return []; }
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
