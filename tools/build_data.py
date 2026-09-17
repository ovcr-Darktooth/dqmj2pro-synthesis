"""Construit site/data.js à partir des bases du patch DQMJ2Pro_Translation_FR.

Usage : python tools/build_data.py [--refresh]
  --refresh : retélécharge les fichiers sources (sinon le cache tools/cache est utilisé)

Entrées :
- Database/synthesis_database.csv : recettes (résultat, rang, famille, 2 ou 4 parents)
- Database/new_synths_kind.csv / new_synths_4g.csv : recettes ajoutées par le patch
- Database/monster_database.csv : taille, stats, traits
- Translation/STRINGS/msg_monstername.txt : noms dans l'ordre des ID internes
  (anglais sur master, français sur la branche traduction-francaise, mêmes lignes)
- tools/names_fr.json (optionnel) : {"<id>": "nom français"}, prioritaire sur la branche FR
- site/icons/index.json : hauteurs des icônes (produit par extract_icons.py)
"""
import csv
import difflib
import io
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / "cache"
BASE = "https://raw.githubusercontent.com/p0chilla/DQMJ2Pro_Translation_FR/"
SOURCES = {
    "synthesis_database.csv": "master/Database/synthesis_database.csv",
    "new_synths_kind.csv": "master/Database/new_synths_kind.csv",
    "new_synths_4g.csv": "master/Database/new_synths_4g.csv",
    "monster_database.csv": "master/Database/monster_database.csv",
    "msg_monstername.txt": "master/Translation/STRINGS/msg_monstername.txt",
    "msg_monstername_fr.txt": "traduction-francaise/Translation/STRINGS/msg_monstername.txt",
}

# Noms du CSV de synthèse absents de msg_monstername (anciennes traductions de fans)
CSV_ALIASES = {"baboon beast": "Baboorood", "evil beast": "Baboodread", "rottney": "Scruffy"}
# Coquilles / anciens noms de monster_database.csv
DB_ALIASES = {
    "slon": "Slon The Rook", "kon": "Kon The Knight", "korol": "King Korol",
    "capricorn": "Kapurigon", "liquid metal slime king": "Liquid Metal King Slime",
    "dark robot slime": "Dark Mecha-Slime", "battering ram": "Damned Ram",
    "goreilla": "Gorerilla", "baboon beast": "Baboorood", "evil beast": "Baboodread",
    "king godwyn": "King Godwyn II",
}
FAMILIES = {"Slime", "Dragon", "Nature", "Beast", "Material", "Demon", "Zombie"}


def fetch(name, refresh):
    path = CACHE / name
    if refresh or not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(BASE + SOURCES[name]) as r:
            path.write_bytes(r.read())
    return path.read_text(encoding="utf-8-sig")


def family(value):
    value = value.strip()
    return value if value in FAMILIES else "???"


def main():
    refresh = "--refresh" in sys.argv
    lines = fetch("msg_monstername.txt", refresh).split("\n")
    by_name = {}
    for mid, name in enumerate(lines):
        name = name.strip()
        if name and name.lower() not in by_name:
            by_name[name.lower()] = mid

    def resolve(name, aliases):
        key = " ".join(name.split()).lower()
        key = aliases.get(key, key).lower()
        return by_name.get(key)

    monsters = {}

    def monster(mid):
        return monsters.setdefault(mid, {"id": mid, "name": {"en": lines[mid].strip()}})

    # Recettes du patch, pour les distinguer des recettes de la ROM originale
    patch_keys = set()
    for fname in ("new_synths_kind.csv", "new_synths_4g.csv"):
        for row in csv.reader(io.StringIO(fetch(fname, refresh))):
            cells = [c.rsplit("|", 1) for c in row if c.strip()]
            if len(cells) < 3:
                continue
            ids = [int(i) for _, i in cells]
            patch_keys.add((ids[-1], tuple(sorted(ids[:-1]))))

    recipes, seen, warnings = [], set(), []
    for row in csv.reader(io.StringIO(fetch("synthesis_database.csv", refresh))):
        row = [c.strip() for c in row] + [""] * 7
        if not row[0] or row[0] in ("Result", "___", "New Recipes") or not row[3]:
            continue
        rid = resolve(row[0], CSV_ALIASES)
        pids = [resolve(p, CSV_ALIASES) for p in row[3:7] if p]
        if rid is None or None in pids:
            warnings.append(f"recette ignorée (nom inconnu) : {row[:7]}")
            continue
        key = (rid, tuple(sorted(pids)))
        if key in seen:
            continue
        seen.add(key)
        m = monster(rid)
        m["rank"], m["family"] = row[1], family(row[2])
        for pid in pids:
            monster(pid)
        recipes.append({"r": rid, "p": pids, "patch": key in patch_keys})

    missing_patch = patch_keys - seen
    if missing_patch:
        warnings.append(f"{len(missing_patch)} recette(s) du patch absentes du CSV : {sorted(missing_patch)}")

    # Stats / taille / traits
    names = [l.strip() for l in lines if l.strip()]
    db_rows = list(csv.reader(io.StringIO(fetch("monster_database.csv", refresh))))[1:]
    for rank, dex, raw, size, fam, *rest in db_rows:
        raw = " ".join(raw.split())
        mid = resolve(raw, DB_ALIASES)
        if mid is None:
            close = difflib.get_close_matches(raw, names, 1, 0.85)
            mid = by_name[close[0].lower()] if close else None
        if mid is None:
            warnings.append(f"stats ignorées (nom inconnu) : {raw}")
            continue
        m = monster(mid)
        m.setdefault("rank", rank.strip())
        m.setdefault("family", family(fam))
        m["dex"] = int(dex)
        m["size"] = int(size) if size.strip().isdigit() else None
        m["stats"] = [int(v) for v in rest[:6]]
        m["traits"] = [t.strip() for t in rest[6:] if t.strip()]

    lines_fr = fetch("msg_monstername_fr.txt", refresh).split("\n")
    if len(lines_fr) != len(lines):
        warnings.append(f"noms FR ignorés : {len(lines_fr)} lignes au lieu de {len(lines)}")
    else:
        for mid, m in monsters.items():
            if lines_fr[mid].strip():
                m["name"]["fr"] = lines_fr[mid].strip()
    names_fr = ROOT / "tools" / "names_fr.json"
    if names_fr.exists():
        for mid, name in json.loads(names_fr.read_text(encoding="utf-8")).items():
            if int(mid) in monsters and name:
                monsters[int(mid)]["name"]["fr"] = name
    missing_fr = [m["name"]["en"] for m in monsters.values() if "fr" not in m["name"]]
    if missing_fr:
        warnings.append(f"{len(missing_fr)} monstre(s) sans nom FR : {missing_fr}")

    icons_index = ROOT / "site" / "icons" / "index.json"
    heights = json.loads(icons_index.read_text()) if icons_index.exists() else {}
    for m in monsters.values():
        m["icon"] = heights.get(str(m["id"]))
        if m["icon"] is None:
            warnings.append(f"pas d'icône pour #{m['id']} {m['name']['en']}")

    data = {"monsters": sorted(monsters.values(), key=lambda m: m["id"]), "recipes": recipes}
    out = ROOT / "site" / "data.js"
    out.write_text("window.DQ_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
                   encoding="utf-8")
    for w in warnings:
        print("⚠", w)
    print(f"{len(recipes)} recettes ({sum(r['patch'] for r in recipes)} du patch), "
          f"{len(monsters)} monstres -> {out}")


if __name__ == "__main__":
    main()
