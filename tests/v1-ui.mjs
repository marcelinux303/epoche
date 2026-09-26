import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const pulse = read("Pulse.qml");
const card = read("PulseCard.qml");
const manifest = JSON.parse(read("manifest.json"));

assert.equal(manifest.id, "io.github.marcelinux303.epoche");
assert.match(manifest.description, /local|offline|reflection/i);

assert.match(pulse, /^import[\s\S]*\nShellRoot\s*\{/m);
assert.equal((pulse.match(/\bPanelWindow\s*\{/g) || []).length, 1);
assert.match(pulse, /property bool windowActive:/);
assert.match(pulse, /property int generation:/);
assert.match(pulse, /property string phase:/);
assert.match(pulse, /pendingPulse/);
assert.match(pulse, /function setLanguage\(/);
assert.match(pulse, /share\/thoughts\/en\.json/);
assert.match(pulse, /share\/thoughts\/fr\.json/);
assert.match(pulse, /WlrLayershell\.layer:\s*WlrLayer\.Overlay/);
assert.match(pulse, /WlrLayershell\.keyboardFocus:\s*WlrKeyboardFocus\.None/);
assert.match(pulse, /exclusionMode:\s*ExclusionMode\.Ignore/);
assert.match(pulse, /mask:\s*Region\s*\{\s*\}/);
assert.doesNotMatch(pulse, /ProxyFloatingWindow/);

assert.doesNotMatch(card, /BorderSurface|full border|radius:/i);
assert.match(card, /readonly property int designWidth:\s*Style\.space\(384\)/);
assert.match(card, /readonly property int clearanceX:\s*Style\.space\(5\)/);
assert.match(card, /readonly property int clearanceY:\s*Style\.space\(5\)/);
assert.match(card, /Color\.popups\.background\.a\s*\*\s*0\.94/);
assert.doesNotMatch(card, /Util\.alpha\(Color\.popups\.background/);
assert.match(card, /text:\s*"Epoché"/);
assert.match(card, /text:\s*"· " \+ root\.category/);
assert.equal((card.match(/id:\s*topLeftCorner/g) || []).length, 1);
assert.equal((card.match(/id:\s*bottomRightCorner/g) || []).length, 1);
assert.match(card, /textFormat:\s*Text\.PlainText/);
assert.match(card, /wrapMode:\s*Text\.Wrap/);
assert.match(card, /elide:\s*Text\.ElideNone/);
assert.doesNotMatch(card, /ShaderEffect|DropShadow|MultiEffect|layer\.enabled/);

for (const [name, value] of [
  ["marksInMs", 175], ["textInDelayMs", 35], ["textInMs", 180],
  ["textOutMs", 145], ["marksOutDelayMs", 20], ["marksOutMs", 155],
  ["surfaceOutMs", 175], ["revealOutDelayMs", 0], ["revealOutMs", 175]
]) assert.match(pulse, new RegExp(`readonly property int ${name}:\\s*${value}\\b`));

for (const file of [pulse, card, read("PulseModel.js")]) {
  assert.doesNotMatch(file, /\bProcess\b|XMLHttpRequest|WebSocket|https?:\/\/|Quickshell\.Networking|Qt\.openUrlExternally|ShaderEffect|DropShadow|MultiEffect/i);
}

console.log("OK — V1 frozen UI, lifecycle architecture, passive surface and manifest guards.");
