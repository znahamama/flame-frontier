"""Make sure every reference source in data/manual/sources.json is present in docs/ref/
with the pinned SHA-256. Downloads only what is missing and has a direct URL.
docs/ref/*.pdf is gitignored, so a fresh clone needs this once (a few MB)."""
from __future__ import annotations

import hashlib
import json
import sys
import urllib.request

from _common import ROOT

sources = json.loads((ROOT / "data/manual/sources.json").read_text())
bad = 0
for sid, s in sources.items():
    path = ROOT / s["file"]
    if s["sha256"] is None:
        state = "present, pin its sha256" if path.exists() else "not saved yet"
        print(f"PENDING    {s['file']} ({sid}): {state}")
        continue
    if not path.exists():
        url = s.get("url", "")
        if not url.endswith(".pdf") and "/downloads/" not in url:
            print(f"MISSING    {s['file']} ({sid}): no direct download. See docs/ref/README.md")
            bad += 1
            continue
        print(f"download   {s['file']}")
        req = urllib.request.Request(url, headers={"User-Agent": "flame-frontier-research/0.1"})
        with urllib.request.urlopen(req, timeout=60) as r:
            path.write_bytes(r.read())
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != s["sha256"]:
        print(f"CHECKSUM   {s['file']}: expected {s['sha256'][:12]}..., got {digest[:12]}...")
        bad += 1
    else:
        print(f"ok         {s['file']}")
sys.exit(1 if bad else 0)
