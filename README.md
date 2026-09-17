# Synthèses DQMJ2 Pro

Site statique listant toutes les synthèses spéciales de *Dragon Quest Monsters: Joker 2 Professional*,
avec l'icône de chaque monstre, une fiche par monstre (stats, traits, recettes pour l'obtenir, recettes où il sert),
un sélecteur de langue et un réglage « ROM originale / ROM patchée ».

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
python tools/build_data.py --refresh
```

- `extract_icons.py` lit `MonsterIconDat.NICA` dans la ROM et écrit `site/icons/<id>.png` (+ `index.json`).
  Le format est documenté en tête du script.
- `build_data.py` télécharge les bases de [DQMJ2Pro_Translation_FR](https://github.com/p0chilla/DQMJ2Pro_Translation_FR)
  (cache dans `tools/cache/`) et écrit `site/data.js`. Les recettes présentes dans `new_synths_*.csv` sont marquées
  « patch » et masquées en mode ROM originale.

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

Pensez à incrémenter `?v=` dans `site/index.html` après modification de `style.css`, `app.js` ou `data.js`.
