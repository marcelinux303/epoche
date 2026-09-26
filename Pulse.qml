import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Hyprland
import Quickshell.Wayland
import qs.Commons
import "PulseModel.js" as PulseModel

ShellRoot {
    id: root

    property bool opened: false
    property var shell: null
    property var manifest: null
    property string configText: ""
    property var inlineEntry: null
    property int intervalMinutes: 45

    property var canonicalCorpus: []
    property var frenchTranslations: ({})
    property var corpus: []
    property bool canonicalReady: false
    property bool translationReady: false
    property bool configReady: false
    property string languagePreference: "auto"
    property string effectiveLanguage: "en"

    property bool pendingOpen: false
    property int previousIndex: -1
    property var currentPulse: ({
            id: "",
            category: "",
            text: ""
        })
    property var pendingPulse: null
    property var targetScreen: null
    property bool windowActive: false
    property string phase: "IDLE"
    property int generation: 0
    property int transitionGeneration: 0

    readonly property bool ready: !!shell && !!manifest && configReady && canonicalReady && translationReady
    readonly property bool canRun: ready && corpus.length > 0
    readonly property real topMargin: Style.space(16) + (shell && shell.bar && shell.bar.position === "top" && !shell.bar.barHidden ? Math.max(0, shell.bar.barSize) : 0)

    readonly property int marksInMs: 175
    readonly property int textInDelayMs: 35
    readonly property int textInMs: 180
    readonly property int textOutMs: 145
    readonly property int marksOutDelayMs: 20
    readonly property int marksOutMs: 155
    readonly property int surfaceOutMs: 175
    readonly property int revealOutDelayMs: 0
    readonly property int revealOutMs: 175

    function selectScreen() {
        var screens = Quickshell.screens;
        if (!screens.length)
            return null;
        var focused = Hyprland.focusedMonitor;
        for (var i = 0; i < screens.length; i++) {
            if (focused && screens[i].name === focused.name)
                return screens[i];
        }
        return screens[0];
    }

    function applyConfig() {
        if (!manifest || !configReady)
            return;
        inlineEntry = PulseModel.entryFor(configText, manifest.id);
        intervalMinutes = PulseModel.settingsFor(inlineEntry).intervalMinutes;
    }

    function rebuildCorpus() {
        if (!canonicalReady || !translationReady)
            return;
        var locale = Qt.locale();
        effectiveLanguage = PulseModel.resolveLanguage(languagePreference, locale.uiLanguages || [], locale.name);
        corpus = PulseModel.localizeCatalog(canonicalCorpus, frenchTranslations, effectiveLanguage);
        if (pendingPulse) {
            var pendingIndex = PulseModel.indexForId(corpus, pendingPulse.id);
            pendingPulse = pendingIndex >= 0 ? corpus[pendingIndex] : null;
        }
        if (phase === "MEASURING" && currentPulse && currentPulse.id) {
            var measuringIndex = PulseModel.indexForId(corpus, currentPulse.id);
            if (measuringIndex >= 0)
                currentPulse = corpus[measuringIndex];
        }
        if (ready && pendingOpen)
            showPulse();
    }

    onManifestChanged: applyConfig()
    onReadyChanged: {
        if (ready && pendingOpen)
            showPulse();
    }

    function open(payloadJson) {
        showPulse();
    }

    function close() {
        generation += 1;
        pendingOpen = false;
        pendingPulse = null;
        opened = false;
        hideTimer.stop();
        appearAnimation.stop();
        disappearAnimation.stop();
        if (!windowActive) {
            phase = "IDLE";
            return;
        }
        beginDisappear(generation);
    }

    function showPulse() {
        if (!ready) {
            pendingOpen = true;
            return;
        }
        if (!canRun)
            return;
        var selected = selectScreen();
        if (!selected) {
            pendingOpen = true;
            close();
            pendingOpen = true;
            return;
        }

        generation += 1;
        targetScreen = selected;
        pendingOpen = false;
        opened = true;
        hideTimer.stop();
        appearAnimation.stop();
        disappearAnimation.stop();

        var visibleIndex = PulseModel.indexForId(corpus, currentPulse && currentPulse.id ? currentPulse.id : "");
        previousIndex = PulseModel.pickNext(corpus, visibleIndex, Math.random());
        pendingPulse = corpus[previousIndex];
        if (!windowActive || (card.surfaceOpacity < 0.01 && card.contentOpacity < 0.01 && card.marksOpacity < 0.01)) {
            applyPending(generation);
        } else {
            beginDisappear(generation);
        }
    }

    function applyPending(token) {
        if (token !== generation || !pendingPulse)
            return;
        currentPulse = pendingPulse;
        pendingPulse = null;
        card.surfaceOpacity = 0;
        card.contentOpacity = 0;
        card.marksOpacity = 0;
        card.revealProgress = 0;
        windowActive = true;
        phase = "MEASURING";
        Qt.callLater(function () {
            if (token === root.generation && root.opened && !root.pendingPulse)
                root.beginAppear(token);
        });
    }

    function beginAppear(token) {
        transitionGeneration = token;
        phase = "APPEAR";
        appearAnimation.start();
    }

    function beginDisappear(token) {
        transitionGeneration = token;
        phase = "DISAPPEAR";
        hideTimer.stop();
        disappearAnimation.start();
    }

    function finishDisappear() {
        if (transitionGeneration !== generation)
            return;
        if (pendingPulse && opened) {
            applyPending(generation);
        } else {
            phase = "IDLE";
            windowActive = false;
        }
    }

    function setLanguage(value) {
        var requested = PulseModel.validateLanguagePreference(value);
        if (!requested)
            return "invalid language; expected auto, en or fr";
        languagePreference = requested;
        rebuildCorpus();
        return "ok";
    }

    function setInterval(minutes) {
        if (!shell || !manifest || !configReady)
            return "not ready";
        var entry = PulseModel.updatedEntry(inlineEntry, manifest.id, minutes);
        if (!entry)
            return "invalid interval or missing inline entry";
        if (typeof shell.updateEntryInline !== "function")
            return "settings API unavailable";
        var changed = shell.updateEntryInline(manifest.id, entry);
        if (!changed && JSON.stringify(entry) !== JSON.stringify(inlineEntry))
            return "settings not updated";
        inlineEntry = entry;
        intervalMinutes = entry.intervalMinutes;
        if (canRun)
            periodicTimer.restart();
        return "ok";
    }

    FileView {
        id: englishCatalogFile
        path: decodeURIComponent(Qt.resolvedUrl("share/thoughts/en.json").toString().replace(/^file:\/\//, ""))
        blockLoading: false
        printErrors: false
        onLoaded: {
            root.canonicalCorpus = PulseModel.parseCanonicalCatalog(text());
            if (!root.canonicalCorpus.length)
                console.warn("Epoché: invalid canonical English catalog: " + path);
            root.canonicalReady = true;
            root.rebuildCorpus();
        }
        onLoadFailed: {
            console.warn("Epoché: failed to load canonical English catalog: " + path);
            root.canonicalCorpus = [];
            root.canonicalReady = true;
            root.rebuildCorpus();
        }
    }

    FileView {
        id: frenchCatalogFile
        path: decodeURIComponent(Qt.resolvedUrl("share/thoughts/fr.json").toString().replace(/^file:\/\//, ""))
        blockLoading: false
        printErrors: false
        onLoaded: {
            root.frenchTranslations = PulseModel.parseTranslationCatalog(text(), "fr");
            if (!Object.keys(root.frenchTranslations).length)
                console.warn("Epoché: invalid French catalog; using English fallback: " + path);
            root.translationReady = true;
            root.rebuildCorpus();
        }
        onLoadFailed: {
            console.warn("Epoché: failed to load French catalog; using English fallback: " + path);
            root.frenchTranslations = {};
            root.translationReady = true;
            root.rebuildCorpus();
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

    ParallelAnimation {
        id: appearAnimation

        NumberAnimation {
            target: card
            property: "surfaceOpacity"
            to: 1
            duration: root.marksInMs
            easing.type: Easing.OutCubic
        }
        NumberAnimation {
            target: card
            property: "marksOpacity"
            to: 1
            duration: root.marksInMs
            easing.type: Easing.OutCubic
        }
        NumberAnimation {
            target: card
            property: "revealProgress"
            to: 1
            duration: root.marksInMs
            easing.type: Easing.OutCubic
        }
        SequentialAnimation {
            PauseAnimation {
                duration: root.textInDelayMs
            }
            NumberAnimation {
                target: card
                property: "contentOpacity"
                to: 1
                duration: root.textInMs
                easing.type: Easing.OutCubic
            }
        }
        onFinished: {
            if (root.transitionGeneration !== root.generation || !root.opened)
                return;
            root.phase = "HOLD";
            hideTimer.restart();
            periodicTimer.restart();
        }
    }

    ParallelAnimation {
        id: disappearAnimation

        NumberAnimation {
            target: card
            property: "contentOpacity"
            to: 0
            duration: root.textOutMs
            easing.type: Easing.InCubic
        }
        NumberAnimation {
            target: card
            property: "surfaceOpacity"
            to: 0
            duration: root.surfaceOutMs
            easing.type: Easing.InCubic
        }
        SequentialAnimation {
            PauseAnimation {
                duration: root.marksOutDelayMs
            }
            NumberAnimation {
                target: card
                property: "marksOpacity"
                to: 0
                duration: root.marksOutMs
                easing.type: Easing.InCubic
            }
        }
        SequentialAnimation {
            PauseAnimation {
                duration: root.revealOutDelayMs
            }
            NumberAnimation {
                target: card
                property: "revealProgress"
                to: 0
                duration: root.revealOutMs
                easing.type: Easing.InCubic
            }
        }
        onFinished: root.finishDisappear()
    }

    Connections {
        target: Quickshell
        function onScreensChanged() {
            if (root.pendingOpen && Quickshell.screens.length) {
                root.showPulse();
                return;
            }
            if (root.targetScreen && Quickshell.screens.indexOf(root.targetScreen) < 0) {
                root.close();
                root.targetScreen = null;
            }
        }
    }

    PanelWindow {
        id: panel
        screen: root.targetScreen
        visible: root.windowActive && root.targetScreen !== null
        anchors.top: true
        margins.top: root.topMargin
        implicitWidth: card.width
        implicitHeight: card.height
        color: "transparent"
        WlrLayershell.namespace: "io-github-marcelinux303-epoche"
        WlrLayershell.layer: WlrLayer.Overlay
        WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
        exclusionMode: ExclusionMode.Ignore
        mask: Region {}

        PulseCard {
            id: card
            category: root.currentPulse.category
            phrase: root.currentPulse.text
        }
    }
}
