"""Shared helpers for the numbered pipeline scripts. Every script must be idempotent:
same inputs -> byte-identical outputs, and files are only rewritten when content changes."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
LLM_CACHE = ROOT / "data" / "llm_cache"
REF = ROOT / "docs" / "ref"

BASS2_REPORT = {
    "doc": "BASS-II Summary Report, NASA/TM-20210011385 (Oct 2021)",
    "file": "docs/ref/BASS-II_Summary_Report_NASA-TM-20210011385.pdf",
    "pdf_page_offset": 8,  # PDF page = printed page + 8
}
CHALLENGE_BRIEF = {"doc": "NASA Space Apps 2026 challenge page, Flame in Freefall", "file": "docs/ref/challenge_brief.md"}

PSI_TO_KPA = 6.894757


def write_json(name: str, obj) -> Path:
    """Write data/processed/<name> deterministically; skip if unchanged."""
    PROCESSED.mkdir(parents=True, exist_ok=True)
    path = PROCESSED / name
    text = json.dumps(obj, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == text:
        print(f"unchanged  {path.relative_to(ROOT)}")
    else:
        path.write_text(text, encoding="utf-8")
        print(f"wrote      {path.relative_to(ROOT)}")
    return path
