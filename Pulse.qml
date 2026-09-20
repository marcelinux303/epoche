import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Hyprland
import Quickshell.Wayland
import qs.Commons
import "PulseModel.js" as PulseModel

Item {
    id: root
    property bool opened: false
    property var shell: null
    property var manifest: null
    property var corpus: []
    property bool corpusReady: false
    property bool configReady: false
    property string configText: ""
    property var inlineEntry: null
    property int intervalMinutes: 45
    property bool pendingOpen: false
    property int previousIndex: -1
    property var currentPulse: ({ category: "", text: "" })
    property var targetScreen: null
    readonly property bool ready: !!shell && !!manifest && configReady && corpusReady
    readonly property bool canRun: ready && corpus.length > 0
    readonly property real topMargin: Style.space(16) +
        (shell && shell.bar && shell.bar.position === "top" && !shell.bar.barHidden
         ? Math.max(0, shell.bar.barSize) : 0)

    function applyConfig() {
        if (!manifest || !configReady) return;
        inlineEntry = PulseModel.entryFor(configText, manifest.id);
        intervalMinutes = PulseModel.settingsFor(inlineEntry).intervalMinutes;
    }
    onManifestChanged: applyConfig()
    onReadyChanged: {
        if (ready && pendingOpen) {
            showPulse();
        }
    }

    // No arbitrary payload content is displayed; repeated early requests coalesce.
    function open(payloadJson) { showPulse(); }
    function close() {
        pendingOpen = false;
        hideTimer.stop();
        opened = false;
    }
    function showPulse() {
        if (!ready) { pendingOpen = true; return; }
        if (!canRun) return;
        var screens = Quickshell.screens;
        if (!screens.length) {
            pendingOpen = true;
            hideTimer.stop();
            opened = false;
            return;
        }
        var monitor = Hyprland.focusedMonitor;
        var selected = screens[0];
        for (var i = 0; i < screens.length; i++) {
            if (monitor && screens[i].name === monitor.name) { selected = screens[i]; break; }
        }
        targetScreen = selected;
        pendingOpen = false;
        periodicTimer.restart();
        previousIndex = PulseModel.pickNext(corpus, previousIndex, Math.random());
        currentPulse = corpus[previousIndex];
        opened = true;
        hideTimer.restart();
    }
    function setInterval(minutes) {
        if (!shell || !manifest || !configReady) return "not ready";
        var entry = PulseModel.updatedEntry(inlineEntry, manifest.id, minutes);
        if (!entry) return "invalid interval or missing inline entry";
        if (typeof shell.updateEntryInline !== "function") return "settings API unavailable";
        var changed = shell.updateEntryInline(manifest.id, entry);
        if (!changed && JSON.stringify(entry) !== JSON.stringify(inlineEntry)) return "settings not updated";
        inlineEntry = entry;
        intervalMinutes = entry.intervalMinutes;
        if (canRun) periodicTimer.restart();
        return "ok";
    }

    FileView {
        id: corpusFile
        path: decodeURIComponent(Qt.resolvedUrl("share/pulses.json").toString().replace(/^file:\/\//, ""))
        blockLoading: false
        printErrors: false
        onLoaded: {
            root.corpus = PulseModel.parseCorpus(text());
            if (!root.corpus.length)
                console.warn("Epoché: empty or invalid corpus: " + path);
            root.corpusReady = true;
        }
        onLoadFailed: {
            console.warn("Epoché: failed to load corpus: " + path);
            root.corpus = [];
            root.corpusReady = true;
        }
    }
    FileView {
        path: Quickshell.env("HOME") + "/.config/omarchy/shell.json"
        blockLoading: false
        printErrors: false
        watchChanges: true
        onFileChanged: reload()
        onLoaded: {
            root.configText = text();
            root.configReady = true;
            root.applyConfig();
        }
        onLoadFailed: {
            root.configText = "";
            root.configReady = true;
            root.applyConfig();
        }
    }
    Timer {
        id: periodicTimer
        interval: PulseModel.intervalMs(root.intervalMinutes)
        running: root.canRun
        repeat: true
        triggeredOnStart: false
        onTriggered: root.showPulse()
    }
    Timer {
        id: hideTimer
        interval: PulseModel.durationFor(root.currentPulse.text)
        onTriggered: root.close()
    }
    Connections {
        target: Quickshell
        function onScreensChanged() {
            if (root.pendingOpen) {
                if (Quickshell.screens.length) root.showPulse();
                return;
            }
            if (!root.targetScreen) {
                if (root.opened) root.close();
                return;
            }
            if (Quickshell.screens.indexOf(root.targetScreen) < 0) {
                root.close();
                root.targetScreen = null;
            }
        }
    }
    PanelWindow {
        id: panel
        screen: root.targetScreen
        visible: root.targetScreen !== null && (root.opened || card.opacity > 0)
        anchors.top: true
        margins.top: root.topMargin
        implicitWidth: card.width
        implicitHeight: card.height
        color: "transparent"
        WlrLayershell.namespace: "marcelinux-epoche"
        WlrLayershell.layer: WlrLayer.Overlay
        WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
        exclusionMode: ExclusionMode.Ignore
        mask: Region {}
        PulseCard {
            id: card
            category: root.currentPulse.category
            phrase: root.currentPulse.text
            shown: root.opened
            availableWidth: root.targetScreen ? Math.max(1, root.targetScreen.width - 2 * Style.space(16)) : 1
        }
    }
}
