"""Construit site/data.js : recettes de la ROM originale + recettes ajoutées par chaque version du patch.

Usage : python tools/build_data.py [--refresh] [--rom "chemin/vers/rom.nds"]
  --refresh : retélécharge la liste des tags et les fichiers de master (les fichiers d'un tag sont figés)
  --rom     : relit les tables de synthèse de la ROM japonaise et réécrit tools/vanilla_synths.json

Entrées :
- tools/vanilla_synths.json : tables CombinationKindTbl.bin (2 parents) et Combination4GTbl.bin (4 parents)
  de la ROM originale, [résultat, parents...] en ID internes (produit par --rom)
- DQMJ2Pro_Translation (Saneezore), pour chaque tag de version >= MIN_VERSION :
  Database/new_synths_kind.csv / new_synths_4g.csv, lignes « Nom|ID » que le patcher ajoute aux tables
  de la ROM. Les tags aux recettes identiques sont regroupés en une seule version.
- Dernier tag : Database/monster_database.csv (rang, famille, taille, stats, traits) et
  Translation/STRINGS/msg_monstername.txt (noms anglais dans l'ordre des ID internes)
- DQMJ2Pro_Translation_FR (p0chilla), branche traduction-francaise : msg_monstername.txt en français
- tools/names_fr.json (optionnel) : {"<id>": "nom français"}, prioritaire sur la branche FR
- site/icons/index.json : hauteurs des icônes (produit par extract_icons.py)
"""
import csv
import difflib
import io
import json
import re
import struct
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / "cache"
VANILLA = ROOT / "tools" / "vanilla_synths.json"
REPO = "Saneezore/DQMJ2Pro_Translation"
RAW = f"https://raw.githubusercontent.com/{REPO}/"
API = f"https://api.github.com/repos/{REPO}/"
FR_NAMES = ("https://raw.githubusercontent.com/p0chilla/DQMJ2Pro_Translation_FR/"
            "traduction-francaise/Translation/STRINGS/msg_monstername.txt")
MIN_VERSION = (1, 0, 0)
TAG_RE = re.compile(r"^(?:gui-)?v(\d+)\.(\d+)\.(\d+)$")
PATCH_FILES = ("Database/new_synths_kind.csv", "Database/new_synths_4g.csv")
ROM_TABLES = (("CombinationKindTbl.bin", "kind", 3), ("Combination4GTbl.bin", "4g", 5))

# Coquilles / anciens noms de monster_database.csv
DB_ALIASES = {
    "slon": "Slon The Rook", "kon": "Kon The Knight", "korol": "King Korol",
    "capricorn": "Kapurigon", "liquid metal slime king": "Liquid Metal King Slime",
    "dark robot slime": "Dark Mecha-Slime", "battering ram": "Damned Ram",
    "goreilla": "Gorerilla", "baboon beast": "Baboorood", "evil beast": "Baboodread",
}
FAMILIES = {"Slime", "Dragon", "Nature", "Beast", "Material", "Demon", "Zombie"}


def fetch(url, cache_name, refresh=False):
    path = CACHE / cache_name
    if refresh or not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "dqmj2pro-synthese"})
        with urllib.request.urlopen(req) as r:
            path.write_bytes(r.read())
    return path.read_text(encoding="utf-8-sig")


def family(value):
    value = value.strip()
    return value if value in FAMILIES else "???"


def extract_vanilla(rom_path):
    import ndspy.rom
    rom = ndspy.rom.NintendoDSRom.fromFile(rom_path)
    tables = {}
    for fname, kind, fields in ROM_TABLES:
        data = rom.getFileByName(fname)
        rows = []
        for o in range(0, len(data) - 2 * fields + 1, 2 * fields):
            row = struct.unpack_from(f"<{fields}H", data, o)
            if row[0] == 0xFFFF:
                break
            rows.append(list(row))
        tables[kind] = rows
    VANILLA.write_text(json.dumps(tables, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{sum(map(len, tables.values()))} recettes de la ROM -> {VANILLA}")


def release_tags(refresh):
    """Tags de version, du plus ancien au plus récent : [(numéro, tag)], un tag par numéro."""
    tags = json.loads(fetch(API + "tags?per_page=100", "tags.json", refresh))
    by_version = {}
    for tag in (t["name"] for t in tags):
        m = TAG_RE.match(tag)
        if m and tuple(map(int, m.groups())) >= MIN_VERSION:
            # « v1.2.0 » et « gui-v1.2.0 » : même numéro, on garde le tag le plus court
            version = tuple(map(int, m.groups()))
            if version not in by_version or len(tag) < len(by_version[version]):
                by_version[version] = tag
    return sorted(by_version.items())


def tag_date(tag, refresh):
    commit = json.loads(fetch(API + f"commits/{tag}", f"{tag}/commit.json", refresh))
    return commit["commit"]["committer"]["date"][:10]


def patch_recipes(tag):
    """Recettes ajoutées par le patch à ce tag : [(résultat, (parents...))] dans l'ordre des fichiers."""
    out = []
    for fname in PATCH_FILES:
        for row in csv.reader(io.StringIO(fetch(RAW + f"{tag}/{fname}", f"{tag}/{Path(fname).name}"))):
            cells = [c.rsplit("|", 1) for c in row if c.strip()]
            if len(cells) < 3:
                continue
            ids = [int(i) for _, i in cells]
            out.append((ids[-1], tuple(ids[:-1])))
    return out


def fmt_version(v):
    return "v" + ".".join(map(str, v))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    refresh = "--refresh" in sys.argv
    if "--rom" in sys.argv:
        extract_vanilla(sys.argv[sys.argv.index("--rom") + 1])
    if not VANILLA.exists():
        sys.exit(f"{VANILLA} absent : lancer une fois avec --rom \"chemin/vers/rom.nds\"")
    warnings = []

    # Versions du patch : les tags consécutifs aux recettes identiques sont regroupés
    groups = []
    for version, tag in release_tags(refresh):
        recipes = patch_recipes(tag)
        if groups and groups[-1]["recipes"] == recipes:
            groups[-1]["last"] = version
            groups[-1]["tags"].append(tag)
        else:
            groups.append({"first": version, "last": version, "tags": [tag], "recipes": recipes})
    latest = groups[-1]["tags"][-1]

    lines = fetch(RAW + f"{latest}/Translation/STRINGS/msg_monstername.txt", f"{latest}/msg_monstername.txt").split("\n")
    by_name = {}
    for mid, name in enumerate(lines):
        name = name.strip()
        if name and name.lower() not in by_name:
            by_name[name.lower()] = mid

    monsters = {}

    def monster(mid):
        if not 0 < mid < len(lines) or not lines[mid].strip():
            return None
        return monsters.setdefault(mid, {"id": mid, "name": {"en": lines[mid].strip()}})

    def valid(rid, pids, source):
        if all(monster(i) for i in (rid, *pids)):
            return True
        warnings.append(f"recette ignorée (ID inconnu) dans {source} : {rid} <- {pids}")
        return False

    vanilla = json.loads(VANILLA.read_text(encoding="utf-8"))
    recipes, seen, by_parents = [], set(), {}
    for rid, *pids in vanilla["kind"] + vanilla["4g"]:
        key = (rid, tuple(sorted(pids)))
        if key in seen or not valid(rid, pids, "la ROM"):
            continue
        seen.add(key)
        by_parents.setdefault(key[1], rid)
        recipes.append({"r": rid, "p": pids, "patch": False})

    versions = []
    for g in reversed(groups):
        label = fmt_version(g["first"]) + ("" if g["first"] == g["last"] else " – " + fmt_version(g["last"]))
        added, added_keys = [], set()
        for rid, pids in g["recipes"]:
            key = (rid, tuple(sorted(pids)))
            if key in seen or key in added_keys or not valid(rid, pids, label):
                continue
            # Le patcher ajoute ses lignes après celles de la ROM : celle de la ROM reste prioritaire
            if key[1] in by_parents and by_parents[key[1]] != rid:
                warnings.append(f"{label} : mêmes parents que la recette ROM de #{by_parents[key[1]]} -> #{rid}")
            added_keys.add(key)
            added.append({"r": rid, "p": list(pids), "patch": True})
        versions.append({"label": label, "tags": g["tags"], "date": tag_date(g["tags"][0], refresh),
                         "recipes": added})

    # Rang / famille / taille / stats / traits
    names = [l.strip() for l in lines if l.strip()]
    db = fetch(RAW + f"{latest}/Database/monster_database.csv", f"{latest}/monster_database.csv")
    for rank, dex, raw, size, fam, *rest in list(csv.reader(io.StringIO(db)))[1:]:
        raw = " ".join(raw.split())
        key = DB_ALIASES.get(raw.lower(), raw).lower()
        mid = by_name.get(key)
        if mid is None:
            close = difflib.get_close_matches(raw, names, 1, 0.85)
            mid = by_name[close[0].lower()] if close else None
        if mid is None:
            warnings.append(f"stats ignorées (nom inconnu) : {raw}")
            continue
        m = monster(mid)
        m["rank"] = rank.strip()
        m["family"] = family(fam)
        m["dex"] = int(dex)
        m["size"] = int(size) if size.strip().isdigit() else None
        m["stats"] = [int(v) for v in rest[:6]]
        m["traits"] = [t.strip() for t in rest[6:] if t.strip()]
    # Doublons internes (ex. #480 Stella, cité par erreur dans les premières versions du patch) :
    # rang et famille du monstre de même nom, sans stats
    for m in monsters.values():
        twin = monsters.get(by_name[m["name"]["en"].lower()])
        if "rank" not in m and twin and "rank" in twin:
            m["rank"], m["family"] = twin["rank"], twin["family"]
    no_rank = [m["name"]["en"] for m in monsters.values() if "rank" not in m]
    if no_rank:
        warnings.append(f"{len(no_rank)} monstre(s) sans rang : {no_rank}")

    lines_fr = fetch(FR_NAMES, "msg_monstername_fr.txt", refresh).split("\n")
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

    data = {"monsters": sorted(monsters.values(), key=lambda m: m["id"]), "recipes": recipes,
            "versions": versions}
    out = ROOT / "site" / "data.js"
    out.write_text("window.DQ_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
                   encoding="utf-8")
    for w in warnings:
        print("⚠", w)
    print(f"{len(recipes)} recettes de la ROM, {len(monsters)} monstres -> {out}")
    for v in versions:
        print(f"  patch {v['label']} ({v['date']}) : +{len(v['recipes'])} recettes  [{', '.join(v['tags'])}]")


if __name__ == "__main__":
    main()
