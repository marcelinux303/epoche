# Ops Pulse — Omarchy Quattro

Plugin natif `marcelinux.ops-pulse`, version 1.0.0, auteur marcelinux, licence
[MIT](LICENSE). Une carte discrète propose une des 30 phrases françaises locales,
réparties en DEV, SYS et AI. Aucune phrase ne prétend connaître l’état du système.

## Architecture et sécurité

Un unique plugin `panel`, `keepLoaded: true`, charge `Pulse.qml` dans le processus
QML/Quickshell d’`omarchy-shell`. `PulseCard.qml` utilise `qs.Commons`, `qs.Ui`,
`BorderSurface` et les tokens du thème. `PulseModel.js` contient la logique pure,
évaluée telle quelle par les tests Node. Le corpus UTF-8 est dans
`share/pulses.json`.

Le runtime du plugin ne lance aucun processus, commande ou binaire externe :
aucun `notify-send`, service systemd, accès réseau ou télémétrie. Il lit seulement
son corpus et `~/.config/omarchy/shell.json` via `FileView`. Le réglage demandé
par l’utilisateur est transmis à la façade `shell.updateEntryInline`, avec
l’entrée complète et ses éventuels autres champs conservés.

**Un plugin Omarchy s’exécute non sandboxé dans omarchy-shell.** La façade est
restreinte, mais ce n’est pas une isolation de sécurité. Examiner les sources
avant installation et les changements avant mise à jour. Les composants partagés
Omarchy restent ceux du host, avec leur propre fonctionnement.

## Comportement

Le premier Pulse arrive après un intervalle complet : 45 minutes par défaut.
Une ouverture manuelle remplace la carte et redémarre cet intervalle. Les valeurs
numériques, y compris les chaînes reçues par IPC, sont arrondies à la minute et
bornées entre 1 et 1440 ; les valeurs non numériques sont refusées. Un réglage
absent ou invalide à la lecture revient à 45 minutes.

Une seule demande manuelle est conservée pendant le chargement asynchrone et
l’injection tardive du host. Un corpus vide, illisible ou invalide laisse le
plugin inactif, sans nouvelle tentative automatique. Il n’y a pas de polling.
Le tirage évite la répétition immédiate (sauf corpus réduit à une seule phrase).
La durée de lecture dépend du texte, entre 5 et 12 secondes.

Une seule `PanelWindow` passive apparaît en haut-centre de l’écran focalisé au
moment de l’ouverture, ou du premier écran disponible. Sans écran, rien ne
s’affiche ; la disparition de l’écran cible ferme la carte. La marge tient
compte d’une barre haute visible via `shell.bar`. La surface Overlay ignore les
zones exclusives, laisse traverser les clics et ne prend aucun focus clavier.
La carte se dimensionne naturellement, sans troncature, avec un fondu de
160 ms ; la fenêtre reste visible pendant la sortie. Aucun blur ni shader.

## Installation future et utilisation

Les commandes ci-dessous sont destinées à une utilisation ultérieure dans une
session Omarchy Quattro ; elles ne font pas partie des tests. Remplacer `<url>`
par l’URL Git publiée du dépôt.

```sh
omarchy plugin add <url> --enable
omarchy-shell shell summon marcelinux.ops-pulse
omarchy-shell shell call marcelinux.ops-pulse setInterval 60
```

Gestion du plugin :

```sh
omarchy plugin disable marcelinux.ops-pulse
omarchy plugin enable marcelinux.ops-pulse
omarchy plugin update marcelinux.ops-pulse
omarchy plugin remove marcelinux.ops-pulse
```

Le réglage est enregistré dans l’objet d’identifiant `marcelinux.ops-pulse` du
tableau `plugins` de `~/.config/omarchy/shell.json`, sous `intervalMinutes`.
**Disable supprime cette entrée et donc ses réglages inline.** Après enable,
le délai revient à 45 minutes ; rappeler `setInterval` pour le personnaliser.
Le plugin ne recrée pas une entrée supprimée lors d’un appel de réglage.

## Migration manuelle du prototype

Aucune migration automatique n’est fournie. Avant d’activer le plugin, arrêter
et désactiver manuellement l’ancien timer utilisateur `ops-pulse.timer`, puis
arrêter son service `ops-pulse.service`. Après vérification de leur arrêt,
supprimer manuellement uniquement les copies du prototype :

- `~/.local/bin/ops-pulse`
- `~/.local/share/ops-pulse/pulses.txt`
- `~/.config/systemd/user/ops-pulse.service`
- `~/.config/systemd/user/ops-pulse.timer`

Recharger ensuite manuellement le gestionnaire systemd utilisateur ; nettoyer
si nécessaire l’état d’échec de ces seules unités. Ne supprimer le répertoire
du corpus que s’il est vide. Ces opérations ne sont ni exécutées par le plugin,
ni par les tests, ni par la conversion du dépôt. Les copies déjà installées
restent inchangées. Éviter de faire fonctionner simultanément les deux versions.

## Contrôles avant publication

Depuis le dépôt, sans installation, affichage ou modification du HOME :

```sh
node tests/check.mjs
node --check PulseModel.js
node --check tests/check.mjs
omarchy plugin validate .
git diff --check
git diff
git status --short
```

Les tests utilisent uniquement les API standard Node et couvrent le corpus,
les cas 0/1/N, le tirage, les bornes, les réglages et les garde-fous statiques.
Le validateur contrôle le manifest et les points d’entrée, pas le rendu.

Pour `qmllint`, ajouter `/usr/lib/qt6/qml` aux imports et un répertoire contenant
`qs/Commons` et `qs/Ui` issus du shell installé. Le préfixe `qs` est fourni par
Quickshell à l’exécution. Les métadonnées installées peuvent produire des
avertissements sur `PanelWindow`, `margins` et les membres dynamiques des tokens
`QtObject` ; ne pas présenter ce contrôle comme une validation graphique.
Avant publication, prévoir séparément une revue visuelle autorisée dans une
session de test : thèmes, multi-écran/déconnexion, barre haute, fondu de sortie,
remplacement manuel et désactivation/réactivation. Aucun de ces essais ne doit
être déclenché par les tests hermétiques.
