#!/usr/bin/env python3
"""Build a compact search index from the HuggingFace chords_and_lyrics parquet.

Output: public/data/chordidx.json  (+ .json.gz for fast mobile transfer)
  [ ["artist", "title", rowIdx, "Key"], ... ]  (deduped by artist+title)

rowIdx is the parquet row number == the `offset` used with the HF datasets-server
`rows` endpoint, so the app can fetch the full chord/lyric dicts on demand.
"""
import gzip
import json
import os
import re
import sys

import duckdb

PARQUET = "data/train.parquet"
OUT = "public/data/chordidx.json"

# Harte quality -> our chord suffix
QUAL = {
    "maj": "", "min": "m", "7": "7", "min7": "m7", "maj7": "maj7",
    "maj6": "6", "min6": "m6", "dim": "dim", "dim7": "dim7",
    "hdim": "m7b5", "aug": "aug", "sus2": "sus2", "sus4": "sus4",
    "9": "9", "maj9": "maj9", "min9": "m9", "maj(9)": "add9",
    "min(9)": "madd9", "6/9": "6", "aug(b7)": "7#5", "min7(4)": "m7",
    "maj7(6)": "maj7", "maj2": "add9", "minmaj7": "mMaj7",
}
SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
NOTE = {}
for i, n in enumerate(SHARPS):
    NOTE[n] = i
for i, n in enumerate(FLATS):
    NOTE[n] = i
DEGREE = {1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11}  # major scale semitones


def harte_name(name: str):
    """Convert a Harte chord like 'A:min7/b7', 'D:(*3,*5)', 'N' -> app token."""
    name = name.strip()
    if not name or name == "N":
        return None
    # strip finger-position markers like (*3,*5)
    name = re.sub(r"\(\*[^)]*\)", "", name)
    # root[:quality][/bass]
    m = re.match(r"^([A-G][b#]*?)(?::([^/]*))?(?:/(.*))?$", name)
    if not m:
        return None
    root, qual, bass = m.group(1), m.group(2) or "", m.group(3) or ""
    if root not in NOTE:
        return None  # garbage roots (Ebb, Gbbbb, …)
    q = QUAL.get(qual)
    if q is None:
        # unknown quality — drop parenthesised bits, fall back to root
        q = re.sub(r"\([^)]*\)", "", qual)
    token = f"{root}{q}"
    if bass:
        bm = re.match(r"^([b#]?)(\d)$", bass)
        if bm:
            deg = DEGREE.get(int(bm.group(2)))
            if deg is not None:
                off = deg + (-1 if bm.group(1) == "b" else 1 if bm.group(1) == "#" else 0)
                names = FLATS if "b" in root else SHARPS
                token += f"/{names[(NOTE[root] + off) % 12]}"
        elif bass in NOTE:
            token += f"/{bass}"
    return token


MINOR_IF = ("m", "m7", "m6", "m9", "madd9", "mMaj7", "m7b5", "dim", "dim7")


def detect_key(chord_dict: str):
    """Most frequent chord root; minor if that root's top quality is minor."""
    counts = {}  # root -> {qual: n}
    for line in re.findall(r"\[[^\]]*\]", chord_dict):
        for tok in re.findall(r"'([^']*)'", line):
            h = harte_name(tok)
            if not h:
                continue
            m = re.match(r"^([A-G][b#]?)", h)
            if not m:
                continue
            r = m.group(1)
            q = h[len(r):].split("/")[0] or ""
            c = counts.setdefault(r, {})
            c[q] = c.get(q, 0) + 1
    if not counts:
        # fallback: first chord token's root
        m = re.search(r"'([^']*)'", chord_dict)
        if not m:
            return "C"
        h = harte_name(m.group(1)) or ""
        rm = re.match(r"^([A-G][b#]?)", h)
        root = rm.group(1) if rm else "C"
        return root + ("m" if "min" in h and not h.startswith("maj") else "")
    best_root = max(counts, key=lambda r: (sum(counts[r].values()), -list(counts).index(r)))
    top_q = max(counts[best_root], key=counts[best_root].get)
    is_minor = top_q in MINOR_IF or (top_q.startswith("m") and not top_q.startswith("maj"))
    return f"{best_root}{'m' if is_minor else ''}"


def main():
    con = duckdb.connect()
    rows = con.execute(
        f"SELECT artist_name, song_name, verse_to_harte_chords, row_number() OVER () - 1 "
        f"FROM read_parquet('{PARQUET}')"
    ).fetchall()

    seen = set()
    out = []
    norm_re = re.compile(r"[^a-z0-9]")
    for artist, title, chords, row in rows:
        key = f"{norm_re.sub('', artist.lower())}|{norm_re.sub('', title.lower())}"
        if key in seen:
            continue
        seen.add(key)
        out.append([artist, title, row, detect_key(chords)])

    with open(OUT, "w") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    raw = len(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    with open(OUT + ".gz", "wb") as f:
        f.write(gzip.compress(json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), 9))
    print(f"{len(out)} unique songs -> {OUT} ({raw/1e6:.1f} MB raw)")
    print(f"gzip -> {OUT}.gz ({os.path.getsize(OUT + '.gz')/1e6:.1f} MB)")
    print("sample:", out[0], out[1], out[-1])


if __name__ == "__main__":
    main()