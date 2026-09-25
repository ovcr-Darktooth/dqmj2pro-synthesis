# Synthèses DQMJ2 Pro

Site statique listant toutes les synthèses spéciales de *Dragon Quest Monsters: Joker 2 Professional*,
avec l'icône de chaque monstre, une fiche par monstre (stats, traits, recettes pour l'obtenir, recettes où il sert),
un sélecteur de langue, un réglage « ROM originale / ROM patchée » et un sélecteur de version du patch.

## Lancer le site

Le dossier `site/` se suffit à lui-même (aucune dépendance) : ouvrir `site/index.html`, ou servir le dossier :

```bash
python -m http.server 8765 --directory site
```

## Régénérer les données

```bash
pip install -r tools/requirements.txt
```

```bash
python tools/extract_icons.py "chemin/vers/Dragon Quest Monsters - Joker 2 Professional (J).nds"
```

```bash
python tools/build_data.py --refresh --rom "chemin/vers/Dragon Quest Monsters - Joker 2 Professional (J).nds"
```

- `extract_icons.py` lit `MonsterIconDat.NICA` dans la ROM et écrit `site/icons/<id>.png` (+ `index.json`).
  Le format est documenté en tête du script.
- `build_data.py` écrit `site/data.js` :
  - **ROM originale** : tables `CombinationKindTbl.bin` (2 parents) et `Combination4GTbl.bin` (4 parents) de la ROM,
    lues avec `--rom` et gardées dans `tools/vanilla_synths.json` (sans `--rom`, ce fichier est réutilisé).
  - **ROM patchée** : le patcher ajoute à ces tables les lignes de `Database/new_synths_kind.csv` et
    `new_synths_4g.csv`. Le script les lit pour chaque tag de version ≥ v1.0.0 de
    [DQMJ2Pro_Translation](https://github.com/Saneezore/DQMJ2Pro_Translation) (liste des tags via l'API GitHub)
    et regroupe les tags consécutifs aux recettes identiques en une seule version du sélecteur.
    `synthesis_database.csv` n'est pas utilisé : c'est une documentation, pas ce que le patcher écrit.
  - Noms anglais, rangs, stats et traits : dernier tag. Cache dans `tools/cache/` ; `--refresh` retélécharge la liste
    des tags et les noms FR (les fichiers d'un tag ne changent pas).
  - Une nouvelle release du patch est prise en compte en relançant `python tools/build_data.py --refresh`.

## Noms français

Les noms FR viennent de `Translation/STRINGS/msg_monstername.txt` sur la branche `traduction-francaise`
du dépôt (même ordre de lignes que la version anglaise de `master`). `tools/names_fr.json` (optionnel,
`{"<id interne>": "Nom français"}`) permet de corriger un nom. L'ID interne d'un monstre = son numéro de ligne
(base 0) dans `msg_monstername.txt`, c'est aussi le nom de son icône. La recherche accepte les noms FR et EN.

## Arbre de synthèse

Onglet « Arbre » ou bouton 🌳 d'une fiche (`#t/<id>`). Le plan est calculé par recherche exhaustive :
pour chaque monstre, la recette (ou le choix manuel ‹ › ) qui minimise le nombre de monstres de base.
Un monstre sans synthèse spéciale est une feuille « base » ; un monstre déjà présent dans sa propre branche
est une feuille « ↻ » (à obtenir autrement). Les parents identiques sont regroupés (×4), « Déjà obtenu »
coupe une branche. Choix et monstres obtenus sont mémorisés dans le navigateur.
Le curseur « Niveaux affichés » règle la profondeur dépliée (5 par défaut, ou moins si l'arbre est moins profond).
La zone de l'arbre se déplace au cliquer-glisser (souris) : horizontalement dans le cadre, verticalement en faisant
défiler la page. Le glissement démarre après 5 px, pour ne pas gêner les clics.
Un bouton « retour en haut » apparaît en bas à droite dès 300 px de défilement.

Pensez à incrémenter `?v=` dans `site/index.html` après modification de `style.css`, `app.js` ou `data.js`.
