import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const model = vm.createContext({});
vm.runInContext(read('PulseModel.js'), model, { filename: 'PulseModel.js' });
const corpus = JSON.parse(read('share/pulses.json'));
assert.equal(corpus.length, 30);
assert.equal(new Set(corpus.map(p => p.text)).size, 30);
for (const p of corpus) {
  assert.ok(['DEV', 'SYS', 'AI'].includes(p.category));
  assert.equal(typeof p.text, 'string');
  assert.ok(p.text.trim().length > 0 && p.text.length <= 200);
}
assert.equal(model.parseCorpus(read('share/pulses.json')).length, 30);
for (const raw of ['', '{', 'null', '{}', '42', '[null]', '[{}]',
  JSON.stringify([{category:'OTHER',text:'x'}]),
  JSON.stringify([{category:'DEV',text:' '}]),
  JSON.stringify([{category:'DEV',text:'x'.repeat(201)}]),
  JSON.stringify([corpus[0],corpus[0]])]) assert.equal(model.parseCorpus(raw).length, 0);
assert.equal(model.parseCorpus('[]').length, 0);
assert.equal(model.pickNext([], -1, .5), -1);
assert.equal(model.pickNext([corpus[0]], 0, .9), 0);
for (const count of [2, 3, 30]) {
  const entries = corpus.slice(0, count);
  for (let previous = -1; previous < count; previous++) {
    const seen = new Set();
    for (let n = 0; n <= 1000; n++) {
      const next = model.pickNext(entries, previous, n / 1000);
      assert.ok(next >= 0 && next < count);
      assert.notEqual(next, previous);
      seen.add(next);
    }
    assert.equal(seen.size, count - (previous < 0 ? 0 : 1));
  }
}
for (const bad of [null, undefined, true, false, {}, [], '', ' ', 'abc', Infinity, NaN]) {
  assert.equal(model.validateInterval(bad), null);
  assert.equal(model.settingsFor({intervalMinutes:bad}).intervalMinutes, 45);
  assert.equal(model.intervalMs(bad), 2700000);
}
for (const [input, expected] of [[0,1],[-8,1],[1,1],['60',60],[' 60 ',60],[1.6,2],[1440,1440],[5000,1440]]) {
  assert.equal(model.validateInterval(input), expected);
  assert.equal(model.settingsFor({intervalMinutes:input}).intervalMinutes, expected);
  assert.equal(model.intervalMs(input), expected * 60000);
}
assert.equal(model.settingsFor(null).intervalMinutes, 45);
let lastDuration = 0;
for (let n = 0; n <= 1000; n++) {
  const duration = model.durationFor('x'.repeat(n));
  assert.ok(duration >= 5000 && duration <= 12000 && duration >= lastDuration);
  lastDuration = duration;
}
assert.equal(model.durationFor(null), 5000);
const id = 'marcelinux.ops-pulse';
const entry = {id, intervalMinutes:45, custom:{preserve:true}};
const updated = model.updatedEntry(entry, id, '60');
assert.equal(updated.intervalMinutes,60);
assert.equal(updated.custom.preserve,true);
assert.equal(entry.intervalMinutes,45);
assert.equal(model.updatedEntry(entry,id,'bad'),null);
assert.equal(model.updatedEntry(null,id,60),null);
assert.equal(model.entryFor('{',id),null);
assert.equal(model.entryFor(JSON.stringify({version:1,plugins:[]}),id),null);
assert.equal(model.entryFor(JSON.stringify({version:1,plugins:[entry]}),id).intervalMinutes,45);
const manifest = JSON.parse(read('manifest.json'));
assert.deepEqual(Object.keys(manifest).sort(), ['schemaVersion','id','name','version','author','license','description','kinds','keepLoaded','entryPoints'].sort());
assert.equal(manifest.id,id);
assert.deepEqual(manifest.kinds,['panel']);
assert.equal(manifest.keepLoaded,true);
assert.deepEqual(manifest.entryPoints,{panel:'Pulse.qml'});
for (const file of ['Pulse.qml','PulseCard.qml','PulseModel.js']) {
  const source = read(file);
  assert.doesNotMatch(source, /\bProcess\b|\bexec\w*\s*\(|notify-send|systemd|XMLHttpRequest|\bfetch\s*\(|WebSocket|https?:\/\/|Quickshell\.Networking|Qt\.openUrlExternally/i, file);
}
const qml = read('Pulse.qml');
assert.equal((qml.match(/\bPanelWindow\s*\{/g)||[]).length,1);
assert.match(qml,/mask:\s*Region\s*\{\s*\}/);
assert.match(qml,/WlrKeyboardFocus\.None/);
assert.match(qml,/ExclusionMode\.Ignore/);
assert.doesNotMatch(qml,/required property/);
assert.match(read('PulseCard.qml'), /Text\.PlainText/);
// Exercise the actual QML method bodies without constructing windows or touching HOME.
function qmlMethod(name) {
  const start = qml.indexOf('function ' + name + '(');
  assert.ok(start >= 0);
  let end = qml.indexOf('{', start), depth = 1;
  for (end++; depth; end++) {
    if (qml[end] === '{') depth++;
    if (qml[end] === '}') depth--;
  }
  return qml.slice(start, end);
}
const firstScreen = {name:'one'}, focusedScreen = {name:'two'};
let restarts = 0, hides = 0;
const state = vm.createContext({
  PulseModel:model, ready:false, canRun:false, pendingOpen:false, opened:false,
  corpus, previousIndex:-1, targetScreen:null, currentPulse:null,
  Quickshell:{screens:[firstScreen,focusedScreen]}, Hyprland:{focusedMonitor:{name:'two'}},
  periodicTimer:{restart(){restarts++;}}, hideTimer:{restart(){hides++;},stop(){}},
  shell:null, manifest:null, configReady:false, inlineEntry:null, intervalMinutes:45
});
state.root = state;
for (const name of ['open','close','showPulse','setInterval','onScreensChanged']) vm.runInContext(qmlMethod(name),state);
state.open('{}'); state.open('{}');
assert.equal(state.pendingOpen,true);
assert.equal(restarts,0);
state.ready = true; state.canRun = true;
state.Quickshell.screens = [];
const readyHandler = qml.match(/onReadyChanged: \{([\s\S]*?)\n    \}/)[1];
vm.runInContext(readyHandler,state);
assert.equal(state.pendingOpen,true);
assert.equal(restarts,0);
assert.equal(state.previousIndex,-1);
state.onScreensChanged();
assert.equal(state.pendingOpen,true);
state.Quickshell.screens = [firstScreen,focusedScreen];
state.onScreensChanged();
assert.equal(restarts,1);
assert.equal(state.pendingOpen,false);
state.onScreensChanged();
assert.equal(restarts,1);
state.close(); restarts = 0; hides = 0;
state.showPulse();
assert.equal(state.pendingOpen,false);
assert.equal(state.targetScreen,focusedScreen);
assert.equal(state.opened,true);
const previous = state.previousIndex;
state.open('{}');
assert.notEqual(state.previousIndex,previous);
assert.equal(restarts,2); assert.equal(hides,2);
state.Hyprland.focusedMonitor = null;
state.showPulse(); assert.equal(state.targetScreen,firstScreen);
state.Quickshell.screens = [];
const restartsBefore = restarts, hidesBefore = hides, indexBefore = state.previousIndex;
state.open('{}'); state.open('{}');
assert.equal(state.opened,false);
assert.equal(state.pendingOpen,true);
assert.equal(restarts,restartsBefore);
assert.equal(hides,hidesBefore);
assert.equal(state.previousIndex,indexBefore);
state.onScreensChanged();
assert.equal(state.pendingOpen,true);
state.Quickshell.screens = [firstScreen];
state.onScreensChanged();
assert.equal(state.pendingOpen,false);
assert.equal(state.opened,true);
assert.equal(restarts,restartsBefore + 1);
assert.equal(hides,hidesBefore + 1);
state.close();
state.Quickshell.screens = [];
state.open('{}'); state.close();
state.Quickshell.screens = [firstScreen];
state.onScreensChanged();
assert.equal(state.pendingOpen,false);
assert.equal(state.opened,false);
assert.equal(restarts,restartsBefore + 1);
state.canRun = false;
state.showPulse(); assert.equal(state.opened,false);
assert.equal(state.setInterval(60),'not ready');
let written;
state.shell = {updateEntryInline(pluginId, value){assert.equal(pluginId,id);written=value;return true;}};
state.manifest = {id}; state.configReady = true; state.inlineEntry = entry;
assert.equal(state.setInterval('60'),'ok');
assert.equal(written.custom.preserve,true);
assert.equal(state.intervalMinutes,60);
assert.equal(state.setInterval('bad'),'invalid interval or missing inline entry');
state.inlineEntry = null;
assert.equal(state.setInterval(60),'invalid interval or missing inline entry');
// Run the corpus FileView handlers, including failures, without file I/O.
const corpusFile = qml.split('    FileView {')[1];
const loadedHandler = corpusFile.match(/onLoaded: \{([\s\S]*?)\n        \}/)[1];
const failedHandler = corpusFile.match(/onLoadFailed: \{([\s\S]*?)\n        \}/)[1];
assert.equal((qml.match(/console\./g) || []).length,2);
assert.doesNotMatch(corpusFile,/watchChanges|reload\(/);
for (const raw of [read('share/pulses.json'), '[]', '{', JSON.stringify([corpus[0],{}]), null]) {
  const warnings = [];
  state.console = {warn(message){warnings.push(message);}};
  state.path = '/plugin/share/pulses.json';
  state.text = () => raw;
  state.corpusReady = false;
  vm.runInContext(raw === null ? failedHandler : loadedHandler,state);
  assert.equal(state.corpusReady,true);
  const valid = raw === read('share/pulses.json');
  assert.equal(state.corpus.length,valid ? 30 : 0);
  assert.equal(warnings.length,valid ? 0 : 1);
  if (!valid) {
    assert.match(warnings[0], /Ops Pulse:.*corpus: \/plugin\/share\/pulses.json/);
    assert.match(warnings[0],raw === null ? /failed to load/ : /empty or invalid/);
  }
  state.canRun = valid;
  for (let i = 0; i < 10; i++) { state.showPulse(); state.open('{}'); }
  assert.equal(warnings.length,valid ? 0 : 1);
}
console.log('OK — corpus (30), modèle (0/1/N), réglages, durée, manifest et garde-fous runtime.');
