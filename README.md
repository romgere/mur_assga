# Topo interactif du mur d'escalade de Lardy

Application web mobile pour suivre, au pied du mur, les voies faites au mur
d'escalade de Lardy (ASSGA Escalade, topo 2026-2027).

Production : <https://mur-escalade-lardy.mestres.fr>

[![Netlify Status](https://api.netlify.com/api/v1/badges/41e1ce6a-399f-4fd6-83c6-d764fd6423c5/deploy-status)](https://app.netlify.com/projects/mur-escalade-lardy/deploys)
test
## Fonctionnalités

- **Mur** (mode par défaut) : les voies d'un mur ; on passe d'un mur à
  l'autre en balayant l'écran ou avec la barre de pastilles.
- **Difficulté** : les voies d'une cotation, avec leur mur.
- **Toutes** : toutes les voies, avec des filtres (niveau min/max, faites ou
  non, tête, moulinette, à vue, flash, enchaînées, à retravailler, partielles,
  favoris, compétition) et un tri (par mur, facile→dur, dur→facile).
- **Favoris** : les voies marquées d'une étoile, avec leur mur.
- **Stats** : compteurs de progression globaux (tête, moulinette, faites),
  niveau max par style (à vue, flash, tête et moulinette propres),
  répartition des ascensions par style, voies à retravailler (partielles,
  tête avec chute ou repos, moulinette pas encore en tête) et progression par
  niveau. Tuiles et raccourcis ouvrent « Toutes » sur le filtre correspondant.
- « Tête » et « Moulinette » sont cochées indépendamment ; les compteurs
  globaux et ceux de chaque page se mettent à jour.
- Détails d'ascension (appui long ou clic droit sur Tête / Moul. pour un
  menu rapide, ou bouton crayon) : pour la tête et la moulinette, **à vue**
  ou **flash** (premier essai, sans ou avec informations), ou bien avec
  **chute**, avec **repos** et/ou **partiel** (non terminée). Une voie cochée
  sans détail est enchaînée proprement ; une ascension partielle ne compte pas
  comme faite. Le bouton d'une ascension avec chute, repos ou partielle est en
  pointillés.
- Aide « États d'une voie » : bouton (i) à côté des détails, ou Réglages →
  Aide. Elle décrit chaque état et indique s'il compte comme fait.
- Tutoriel de prise en main au premier lancement (y compris pour les
  utilisateurs d'avant le tutoriel), qu'on peut passer, et à revoir depuis
  Réglages → Aide.
- Favoris, notes par voie (cotation ressentie…), thème Auto / Clair / Sombre.
- Sauvegarde et restauration par copier-coller d'un texte JSON, et effacement
  complet avec confirmation.

Les données restent dans le navigateur (`localStorage`) :

| Clé                        | Contenu                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `lardy.progress.<saison>`  | `{"mur-COULEUR": {t, m, tx, mx, s, n}}` (voir ci-dessous)        |
| `lardy2026.ui`             | mode, page courante de chaque mode, filtres, filtre des stats    |
| `lardy2026.theme`          | `auto`, `light` ou `dark`                                         |
| `lardy2026.version`        | dernière version dont les nouveautés ont été vues                |
| `lardy2026.tutorial`       | `1` une fois le tutoriel passé ou terminé                        |

Dans la progression : `t` / `m` = faite en tête / en moulinette, `tx` / `mx` =
détails de cette ascension (liste de codes `avue`, `flash`, `chute`, `repos`,
`partiel` ; absent = enchaînée proprement), `s` = favori, `n` = note. Les détails sont des champs
ajoutés : les données sans détails restent valides telles quelles. Les
sauvegardes sont en version 3 ; les versions 1 et 2 s'importent toujours.

La progression est rangée par saison (`lardy.progress.2026-2027`…). L'ancienne
clé de la V1, `lardy2026.v1`, est reprise automatiquement dans la saison
2026-2027 au premier lancement.

Si le stockage est indisponible (navigation privée…), l'application continue
en mémoire et le signale dans les réglages.

## Application installable et hors ligne (PWA)

L'application fonctionne sans réseau après une première visite : le service
worker met en cache tout le site, données du topo comprises.

Pour l'installer comme une application, ouvrir **Réglages → Application** :

- **Android, Chrome, Edge** : bouton « Installer l'application ».
- **iPhone / iPad** : la marche à suivre est affichée (Safari → Partager →
  « Sur l'écran d'accueil »), iOS ne proposant pas d'installation directe.

Après un déploiement, la nouvelle version (nouveau topo compris) est
téléchargée en arrière-plan. Si elle arrive dans les 15 secondes qui suivent
l'ouverture de la page ou le retour sur l'application, elle est appliquée
tout de suite (rechargement automatique) : un simple rafraîchissement suffit
donc. Sinon, en cours d'utilisation, un bandeau « Nouvelle version
disponible » propose de recharger (« Mettre à jour ») ou d'attendre
(« Plus tard »). L'application vérifie les mises à jour à chaque retour au
premier plan et toutes les heures. Les voies cochées, en
`localStorage`, sont conservées.

### Notes de version

Les nouveautés de chaque version sont dans
[`src/data/release-notes.json`](src/data/release-notes.json), de la plus
récente à la plus ancienne :

```json
{ "version": "1.2.0", "date": "2026-11-02", "notes": ["Nouvelles voies au mur 3."] }
```

Une nouveauté peut aussi renvoyer vers des étapes du tutoriel pour présenter
la fonctionnalité : un lien « Voir comment ça marche » ouvre ces étapes seules.

```json
{ "text": "Ajout des tags sur les voies.", "tutorial": ["tags"] }
```

Les étapes sont définies par identifiant dans `TUTORIAL_STEPS`
([`tutorial-sheet.ts`](src/components/tutorial-sheet.ts)) ; `ONBOARDING` liste
celles de la prise en main. Une étape dédiée n'a pas à en faire partie. Un test
vérifie que chaque étape citée par les notes existe. Dans le bandeau de mise à
jour, une étape que la version installée ne connaît pas encore n'a pas de lien.

Pour publier une version (application ou topo), ajouter une entrée en tête du
fichier et reporter le même numéro dans `version` de `package.json` (vérifié
par les tests). La version la plus récente du fichier est celle de
l'application. Les notes apparaissent à trois endroits :

- **Bandeau « Nouvelle version disponible »** : un bouton (i) montre les
  nouveautés de la version en attente. Le fichier est aussi publié à la racine
  du site (`/release-notes.json`, hors cache du service worker) : la version
  installée le lit pour connaître celles de la version déployée. Sans entrée
  plus récente (ou hors ligne), le bouton n'apparaît pas.
- **Après une mise à jour** : les nouveautés des versions manquées s'affichent
  une fois au lancement (version vue gardée dans `lardy2026.version`). Rien à la
  toute première visite, ni quand le tutoriel s'ouvre (la version est quand
  même marquée vue).
- **Réglages → Nouveautés** : relire les notes de la version installée.

Les icônes PNG (`public/pwa-*.png`, `maskable-icon-512x512.png`,
`apple-touch-icon-180x180.png`, `favicon.ico`) sont générées depuis
`public/logo-assga.png` (logo du club, 512×512) : après l'avoir modifié, lancer
`npm run generate-pwa-assets` (réglages dans
[`pwa-assets.config.ts`](pwa-assets.config.ts)). Le manifeste est dans
[`vite.config.ts`](vite.config.ts).

## Mettre à jour le topo

Toutes les voies sont dans [`src/data/topo.json`](src/data/topo.json) :

```json
{ "color": "VERTE", "grade": "6a", "setter": "BC" }
{ "color": "VIOLETTE", "grade": "5a+", "competition": true }
{ "color": "BEIGE", "traverse": true }
{ "color": "ROUGE", "grade": "6c", "setter": "L", "rev": 2 }
```

- `color` : nom de la couleur en majuscules. Une nouvelle couleur doit avoir
  ses tokens `--c-<couleur>` et `--c-<couleur>-ink` dans
  [`src/styles/tokens.css`](src/styles/tokens.css).
- `grade` : une valeur de la liste `grades` (sauf traversée).
- `setter` : initiales affichées telles quelles.
- `rev` (optionnel) : révision de la voie, voir ci-dessous.

La progression d'une voie est rattachée à sa clé `mur-COULEUR`, rangée par
saison. Deux cas de renouvellement :

- **Nouvelle saison** : changer `season` (par exemple `"2027-2028"`), ainsi que
  `title` et `updated`. Tout le monde repart d'une progression vide ; celle de
  la saison précédente reste dans le navigateur. Une sauvegarde d'une autre
  saison est refusée à la restauration.
- **Voie rouverte en cours de saison** (même couleur, même mur) : ajouter
  `"rev": 2` à la voie (puis 3, 4… aux réouvertures suivantes). Sa clé
  devient `mur-COULEUR~2` : elle repart de zéro, les autres voies gardent leur
  progression. Retirer `rev` en début de saison suivante.

Le fichier est vérifié au chargement (cotation inconnue, voie en double…) et
par les tests : lancer `npm test` après chaque modification.

## Développement

Prérequis : Node.js 20.19+ ou 22.12+ (exigé par Vite 8). Avec nvm : `nvm use`
(lit [`.nvmrc`](.nvmrc)).

```sh
nvm use
npm install
npm run dev      # serveur de développement
npm test         # tests unitaires (Vitest + happy-dom)
npm run build    # vérification TypeScript + build dans dist/
```

Pile : [Vite](https://vite.dev), [Lit](https://lit.dev), TypeScript.

```
src/
  data/topo.json          données du topo
  data/release-notes.json notes de version (la plus récente = version de l'application)
  lib/                    stockage, store de progression, filtres, thème, état d'interface
  components/             composants Lit, chacun avec son fichier *.test.ts
    lardy-app             racine : en-tête, modes, vue, pastilles, feuilles
    route-pager           pager horizontal en scroll-snap
    pager-dots            barre de pastilles (point plein = toutes faites, évidé = en partie)
    route-list, route-row liste et ligne de voie
    progress-counters     compteurs tête / moulinette / faites
    mode-tabs             sélecteur de mode
    all-routes-view       mode « Toutes » : filtres, tri, liste
    bottom-sheet          feuille modale générique
    note-sheet            édition d'une note
    settings-sheet        thème, nouveautés, sauvegarde, restauration, effacement
    update-banner         bandeau « Nouvelle version disponible » et son bouton (i)
    release-notes-sheet   affichage des notes de version
    tutorial-sheet        tutoriel de prise en main (étapes, pastilles, « Passer »)
    icons                 icônes SVG partagées
  styles/tokens.css       tokens de couleur (clair + sombre) et styles globaux
```

Un clic sur une voie ne repeint que sa ligne et les compteurs : chaque composant
s'abonne au store via `StoreController` et filtre sur l'id de la voie modifiée.
