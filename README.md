# Epoché

Epoché is a native Omarchy panel plugin that presents a brief general thought
about DEV, SYS, or AI.

> Epoché — A moment of reflection between signal and action.

The plugin is local, offline, passive, and non-interactive while displayed. It
does not inspect the machine or the user, make recommendations, diagnose the
system, collect data, use analytics, contact a network service, or run a model
or external process at runtime.

Status: V1 release candidate implementation. The bilingual corpus is still a
**candidate requiring user review**; it is not editorially frozen.

## Identity and compatibility

- Plugin ID: `io.github.marcelinux303.epoche`
- Version: `1.0.0`
- Kind: `panel`
- Runtime: Omarchy shell / Quickshell
- License: [MIT](LICENSE)

The historical native plugin `marcelinux.ops-pulse`, the older Bash/systemd
prototype, and the disposable visual prototypes are separate artifacts. This
repository does not remove or migrate them automatically.

## Design and behavior

The V1 visual design is frozen to Einklammerung A:

- top-center placement;
- `Epoché · CATEGORY` header;
- top-left and bottom-right open corners;
- native Omarchy popup RGB with native alpha multiplied by `0.94`;
- no full border, blur, shadow, shader, or decorative effect;
- click-through Overlay layer, no keyboard focus, ignored exclusive zones;
- exactly one explicit `PanelWindow` under a non-visual `ShellRoot`.

The lifecycle is bounded: IDLE → APPEAR → HOLD → DISAPPEAR → IDLE. Repeated
summons keep only the latest pending thought. Close invalidates deferred work
and always wins. Content and geometry change only while all visual groups are
hidden. The focused screen is used when available, otherwise the first screen;
removing the target screen closes the surface.

A thought remains visible for 5–12 seconds according to text length. The default
periodic interval is 45 minutes and may be configured from 1 to 1440 minutes.
Selection avoids immediate repetition when more than one thought exists.

## Languages and local corpus

The plugin ships two local UTF-8 catalogs:

- `share/thoughts/en.json`: canonical IDs, categories, and English text;
- `share/thoughts/fr.json`: French text keyed by the same IDs.

The current candidate contains 72 thoughts: 24 DEV, 24 SYS, and 24 AI. Release
checks require complete EN/FR ID coverage. At runtime, an unreadable or invalid
French catalog falls back to English; an isolated missing French entry falls
back to the matching English entry. Invalid canonical English disables new
selection.

Language preference is runtime-only in V1:

```sh
omarchy-shell shell call io.github.marcelinux303.epoche setLanguage auto
omarchy-shell shell call io.github.marcelinux303.epoche setLanguage en
omarchy-shell shell call io.github.marcelinux303.epoche setLanguage fr
```

`auto` checks the ordered UI language list, then the current locale, and falls
back to English. A language change applies to the next appearance and does not
replace a thought already visible.

## Installation and use

No publication is performed by this repository state. Once a public Git URL is
approved, installation is expected to use:

```sh
omarchy plugin add <git-url> --enable
omarchy-shell shell summon io.github.marcelinux303.epoche
omarchy-shell shell call io.github.marcelinux303.epoche setInterval 60
```

Management commands:

```sh
omarchy plugin disable io.github.marcelinux303.epoche
omarchy plugin enable io.github.marcelinux303.epoche
omarchy plugin update io.github.marcelinux303.epoche
omarchy plugin remove io.github.marcelinux303.epoche
```

`setInterval` updates the plugin's inline `intervalMinutes` setting through the
Omarchy shell facade while preserving other fields. Disabling a plugin may
remove its inline settings; after re-enabling, set the interval again if needed.

## Runtime architecture and security

- `Pulse.qml`: host API, lifecycle, timers, screen choice, and fixed local file
  loading.
- `PulseCard.qml`: frozen visual composition only.
- `PulseModel.js`: pure catalog validation, locale/fallback logic, selection,
  duration, and settings helpers.
- `share/thoughts/`: bundled EN/FR corpus candidate.

The runtime reads only bundled catalogs and
`~/.config/omarchy/shell.json` using `FileView`. It contains no `Process`, shell
execution, HTTP client, WebSocket, external API, telemetry, analytics,
behavioral tracking, diagnostics, or persistence of language choice.

Omarchy plugins execute unsandboxed inside `omarchy-shell`. Review source changes
before installation or update; this architecture minimizes capabilities but is
not a security sandbox.

## Historical migration plan

Do not remove the old native `marcelinux.ops-pulse` plugin or the older
Bash/systemd prototype until Epoché has passed real-desktop review and the user
explicitly approves retirement.

Recommended staged migration:

1. Install Epoché without deleting historical components.
2. Avoid simultaneous automatic display by disabling only the old component
   chosen for comparison.
3. Validate Epoché EN/FR, lifecycle, focus, click-through, screen handling, and
   uninstall behavior on the real desktop.
4. Obtain explicit approval for the retirement plan.
5. Only then disable/remove the approved historical component using its own
   documented mechanism.

Possible old Bash/systemd paths, to be touched only after approval, are:

- `~/.local/bin/ops-pulse`
- `~/.local/share/ops-pulse/pulses.txt`
- `~/.config/systemd/user/ops-pulse.service`
- `~/.config/systemd/user/ops-pulse.timer`

Epoché performs none of these operations itself.

## Contributing to the corpus

Treat English IDs as the semantic contract. A corpus change should:

1. use a stable lowercase kebab-case ID;
2. assign exactly one category: DEV, SYS, or AI;
3. remain general rather than claiming knowledge of a person or machine;
4. avoid advice, alerts, diagnosis, productivity coaching, or activity-based
   language;
5. provide idiomatic English and French expressions of the same concept;
6. preserve NFC text, local/offline delivery, and complete ID parity;
7. pass tests and receive editorial review before being described as final.

Phrases such as “Your system…”, “You should…”, “We noticed…”, or “Based on your
activity…” are outside the product philosophy.

## Validation

From the repository:

```sh
node tests/check.mjs
node --check PulseModel.js
node --check tests/check.mjs
node --check tests/v1-model.mjs
node --check tests/v1-lifecycle.mjs
node --check tests/v1-ui.mjs
/usr/lib/qt6/bin/qmlformat Pulse.qml > /tmp/Pulse.qml.formatted
/usr/lib/qt6/bin/qmlformat PulseCard.qml > /tmp/PulseCard.qml.formatted
/usr/lib/qt6/bin/qmllint Pulse.qml PulseCard.qml
omarchy plugin validate <clean-package-directory>
git diff --check
```

`qmllint` may warn about the runtime-provided `qs.Commons` import, dynamically
provided theme singletons, and Quickshell layer-shell types when run without the
shell import environment. It must still exit successfully and report no syntax
error. Validate the plugin from a clean package directory because `.prototype/`
is intentionally excluded from the product but may contain local symlinks that
the package validator rejects.

Real release review must additionally verify one layer surface, no regular or
floating Quickshell client, top-center geometry, input passthrough, unchanged
keyboard focus, lifecycle interruption cases, EN/FR/English fallback, longest
texts, light and dark backgrounds, and clean disable/remove behavior.
