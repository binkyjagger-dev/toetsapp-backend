#!/usr/bin/env python3
"""
safe_replace.py — UTF-8-veilige str_replace voor bestanden met emoji.

Gebruik:
  python3 scripts/safe_replace.py <bestand> <old_string> <new_string>

Of importeer de functie:
  from scripts.safe_replace import safe_replace
  safe_replace('netlify-deploy/mol-js/docent-sessie.js', old, new)

Achtergrond:
  De Cowork Edit/Write tools knippen bestanden af bij emoji (UTF-16
  surrogate pairs). Dit script leest en schrijft altijd als UTF-8,
  waardoor emoji-bestanden correct worden behandeld.
"""

import sys


def safe_replace(path: str, old: str, new: str, count: int = 1) -> None:
    """
    Vervang `old` door `new` in het bestand op `path`.
    Faalt met een foutmelding als `old` niet gevonden wordt.
    """
    with open(path, 'r', encoding='utf-8') as f:
        src = f.read()

    if old not in src:
        print(f"FOUT: old_string niet gevonden in {path}", file=sys.stderr)
        print(f"Controleer of de string exact overeenkomt (whitespace, newlines).",
              file=sys.stderr)
        sys.exit(1)

    result = src.replace(old, new, count)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(result)

    print(f"OK: {path} bijgewerkt ({src.count(old)} treffer(s) vervangen)")


if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Gebruik: python3 scripts/safe_replace.py <bestand> <old> <new>",
              file=sys.stderr)
        sys.exit(1)
    safe_replace(sys.argv[1], sys.argv[2], sys.argv[3])
