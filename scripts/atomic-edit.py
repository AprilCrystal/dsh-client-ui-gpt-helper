"""Atomic, validated edits to lib/client.js.

Why this exists, in one paragraph: the client bundle is hot-reloaded, and the watcher
polls the file's mtime, so EVERY intermediate state of a multi-pass edit is published to
the live page. An intermediate state that does not parse fails the whole web boot
("1 entry did not activate"), and so does one with a call to a function that is not defined
yet — which is exactly how `detectSide is not defined` reached the running app while the
finished file was fine.

So: apply the replacements to a temporary file, parse it there, check that no called helper
is left undefined, and only then os.replace() it into position. A rename is atomic, so the
watcher observes the old file or the new one and never a half-written one.

  python scripts/atomic-edit.py edits.json      # [[old, new], ...]; refuses and changes nothing on doubt
"""

from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
CLIENT = ROOT / "lib" / "client.js"
NODE = pathlib.Path(
    r"C:\Users\21683\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
)


def parse_check(source: str) -> tuple[bool, str]:
    """Parses the bundle text with Node, the way the app's loader would."""
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as handle:
        handle.write(source)
        probe = handle.name
    try:
        result = subprocess.run(
            [str(NODE), "-e", "new Function(require('fs').readFileSync(process.argv[1],'utf8'))", probe],
            capture_output=True,
            text=True,
        )
        return result.returncode == 0, result.stderr.strip()
    finally:
        pathlib.Path(probe).unlink(missing_ok=True)


def check_helpers(source: str) -> list[str]:
    """Names called as `name(` that the file never defines.

    This is the `tokenValue is not defined` and `detectSide is not defined` class of bug,
    and it is the one this project has actually shipped twice.
    """
    defined = set(re.findall(r"\bfunction ([a-zA-Z_$][\w$]*)\s*\(", source))
    defined |= set(
        re.findall(
            r"\b(?:const|let|var) ([a-zA-Z_$][\w$]*)\s*=\s*(?:\(|function|[a-zA-Z_$][\w$]*\s*=>)", source
        )
    )
    called = set(re.findall(r"(?<![\w$.])([a-zA-Z_$][\w$]*)\s*\(", source))
    suspects = [
        name
        for name in called
        if re.match(
            r"^(token|normalize|build|read|write|detect|probe|side|scheme|shipped|level|apply|safe|config|override|migrate|merge|scan|directory|discover|empty|edit|is|import|free)[A-Z]",
            name,
        )
        and name not in defined
    ]
    return sorted(suspects)


def atomic_edit(pairs: list[tuple[str, str]]) -> bool:
    """Applies literal replacements and swaps the file in atomically. Returns success."""
    original = CLIENT.read_text(encoding="utf-8")
    text = original
    for old, new in pairs:
        if old not in text:
            print(f"REFUSED: anchor not found -> {old[:70]!r}")
            return False
        text = text.replace(old, new, 1)

    ok, error = parse_check(text)
    if not ok:
        print("REFUSED: the result does not parse ->", error[:400])
        return False

    missing = check_helpers(text)
    if missing:
        print("REFUSED: calls with no definition ->", ", ".join(missing))
        return False

    handle = tempfile.NamedTemporaryFile(
        "w", suffix=".js", dir=str(CLIENT.parent), delete=False, encoding="utf-8", newline=""
    )
    handle.write(text)
    handle.close()
    # One atomic rename: the watcher sees the old file or the new one, never a partial.
    pathlib.Path(handle.name).replace(CLIENT)
    print(f"applied {len(pairs)} replacement(s); {len(original)} -> {len(text)} chars")
    return True


if __name__ == "__main__":
    payload = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    sys.exit(0 if atomic_edit([(entry[0], entry[1]) for entry in payload]) else 1)
