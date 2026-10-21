# Topo interactif du mur d'escalade de Lardy

Application web mobile pour suivre, au pied du mur, les voies faites au mur
d'escalade de Lardy (ASSGA Escalade, topo 2026-2027).

Production : <https://mur-escalade-lardy.mestres.fr>

## Fonctionnalités

- **Par mur** (mode par défaut) : les voies d'un mur ; on passe d'un mur à
  l'autre en balayant l'écran ou avec la barre de pastilles.
- **Par difficulté** : les voies d'une cotation, avec leur mur.
- **Toutes** : toutes les voies, avec des filtres (niveau min/max, faites ou
  non, tête, moulinette, favoris, compétition) et un tri (par mur, facile→dur,
  dur→facile).
- « Tête » et « Moulinette » sont cochées indépendamment ; les compteurs
  globaux et ceux de chaque page se mettent à jour.
- Favoris, notes par voie (cotation ressentie…), thème Auto / Clair / Sombre.
- Sauvegarde et restauration par copier-coller d'un texte JSON, et effacement
  complet avec confirmation.

Les données restent dans le navigateur (`localStorage`) :

| Clé               | Contenu                                                  |
| ----------------- | -------------------------------------------------------- |
| `lardy2026.v1`    | `{"mur-COULEUR": {t, m, s, n}}` : tête, moulinette, favori, note |
| `lardy2026.ui`    | mode, page courante de chaque mode, filtres              |
| `lardy2026.theme` | `auto`, `light` ou `dark`                                 |

Si le stockage est indisponible (navigation privée…), l'application continue
en mémoire et le signale dans les réglages.

## Mettre à jour le topo

Toutes les voies sont dans [`src/data/topo.json`](src/data/topo.json) :

```json
{ "color": "VERTE", "grade": "6a", "setter": "BC" }
{ "color": "VIOLETTE", "grade": "5a+", "competition": true }
{ "color": "BEIGE", "traverse": true }
```

- `color` : nom de la couleur en majuscules. Une nouvelle couleur doit avoir
  ses tokens `--c-<couleur>` et `--c-<couleur>-ink` dans
  [`src/styles/tokens.css`](src/styles/tokens.css).
- `grade` : une valeur de la liste `grades` (sauf traversée).
- `setter` : initiales affichées telles quelles.
- Mettre à jour `updated` (date du topo) et `title` si la saison change.

La progression est rattachée à la clé `mur-COULEUR` : une voie remplacée par
une autre de même couleur sur le même mur garde la coche de l'ancienne. Pour
une nouvelle saison, changer la clé `PROGRESS_KEY` dans
[`src/lib/progress-store.ts`](src/lib/progress-store.ts) repart de zéro.

Le fichier est vérifié au chargement (cotation inconnue, voie en double…) et
par les tests : lancer `npm test` après chaque modification.

## Développement

```sh
npm install
npm run dev      # serveur de développement
npm test         # tests unitaires (Vitest + happy-dom)
npm run build    # vérification TypeScript + build dans dist/
```

Pile : [Vite](https://vite.dev), [Lit](https://lit.dev), TypeScript.

```
src/
  data/topo.json          données du topo
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
    settings-sheet        thème, sauvegarde, restauration, effacement
  styles/tokens.css       tokens de couleur (clair + sombre) et styles globaux
```

Un clic sur une voie ne repeint que sa ligne et les compteurs : chaque composant
s'abonne au store via `StoreController` et filtre sur l'id de la voie modifiée.

## Déploiement sur Netlify

La configuration est dans [`netlify.toml`](netlify.toml) (build `npm run build`,
publication de `dist/`, Node 22).

1. Sur Netlify : **Add new site → Import an existing project**, choisir GitHub
   et le dépôt `romgere/mur_assga`, branche `main`. Les réglages de build sont
   lus dans `netlify.toml`.
2. **Domain management → Add a domain** : `mur-escalade-lardy.mestres.fr`.
3. Chez l'hébergeur DNS de `mestres.fr`, créer l'enregistrement :

   ```
   mur-escalade-lardy  CNAME  <nom-du-site>.netlify.app.
   ```

4. Une fois le DNS propagé, Netlify émet automatiquement le certificat
   Let's Encrypt (**Domain management → HTTPS**, « Verify DNS configuration »
   puis « Provision certificate » si besoin). Activer « Force HTTPS ».

Chaque push sur `main` redéploie le site ; chaque pull request obtient une
prévisualisation.
