"""Extrait les icônes de monstres depuis une ROM de DQMJ2 Professional.

Usage : python tools/extract_icons.py "chemin/vers/rom.nds"

Format (reverse) :
- data/MonsterIconDat.NICA est une archive FPK : "FPK\\0", u32 nb d'entrées,
  puis entrées de 0x28 octets (nom 32 octets, u32 offset, u32 taille).
- ic_XXXX.NCGR (XXXX = ID interne du monstre en hexa) : graphismes 4bpp en
  tuiles 8x8, données à 0x30. ic_XXXX.NCLD : palette brute 16 couleurs BGR555,
  couleur 0 transparente.
- Chaque bloc de 25 tuiles forme 40x40 px, rangé comme des sprites DS :
  32x32 (4x4 tuiles), bande droite 8x32, bande basse 32x8, coin 8x8.
  Les monstres de taille 2/3 empilent 2/3 blocs verticalement (40x80, 40x120).
"""
import json
import struct
import sys
from pathlib import Path

import ndspy.rom
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "site" / "icons"
BLOCK_LAYOUT = [(0, 0, 4, 4), (4, 0, 1, 4), (0, 4, 4, 1), (4, 4, 1, 1)]


def read_fpk(data):
    count = struct.unpack_from("<I", data, 4)[0]
    files = {}
    for i in range(count):
        o = 8 + i * 0x28
        name = data[o:o + 32].split(b"\0")[0].decode()
        off, size = struct.unpack_from("<II", data, o + 32)
        files[name] = data[off:off + size]
    return files


def palette(raw):
    def c5(x):
        return (x << 3) | (x >> 2)
    cols = []
    for i in range(16):
        v = struct.unpack_from("<H", raw, i * 2)[0]
        cols.append((c5(v & 31), c5((v >> 5) & 31), c5((v >> 10) & 31), 0 if i == 0 else 255))
    return cols


def decode(ncgr, ncld):
    pal = palette(ncld)
    size = struct.unpack_from("<I", ncgr, 0x28)[0]
    data = ncgr[0x30:0x30 + size]
    tiles = []
    for t in range(size // 32):
        tile = Image.new("RGBA", (8, 8))
        tile.putdata([pal[(data[t * 32 + i // 2] >> (4 if i % 2 else 0)) & 15] for i in range(64)])
        tiles.append(tile)
    blocks = len(tiles) // 25
    img = Image.new("RGBA", (40, 40 * blocks))
    for b in range(blocks):
        i = b * 25
        for x, y, w, h in BLOCK_LAYOUT:
            for yy in range(h):
                for xx in range(w):
                    img.paste(tiles[i], ((x + xx) * 8, b * 40 + (y + yy) * 8))
                    i += 1
    return img


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    rom = ndspy.rom.NintendoDSRom.fromFile(sys.argv[1])
    files = read_fpk(rom.getFileByName("MonsterIconDat.NICA"))
    OUT.mkdir(parents=True, exist_ok=True)
    heights = {}
    for name, ncgr in files.items():
        if not name.endswith(".NCGR"):
            continue
        key = name[3:7]
        mid = int(key, 16)
        if mid >= 0x1000:  # ic_9995..9999 : icônes spéciales hors bestiaire
            continue
        img = decode(ncgr, files[f"ic_{key}.NCLD"])
        img.save(OUT / f"{mid}.png", optimize=True)
        heights[mid] = img.height
    (OUT / "index.json").write_text(json.dumps(heights, sort_keys=True), encoding="utf-8")
    print(f"{len(heights)} icônes extraites dans {OUT}")


if __name__ == "__main__":
    main()
