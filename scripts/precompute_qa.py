"""Precompute the demo Q&A answers -> data/llm_cache/qa/<hash>.json + data/processed/qa_cache.json.

NOT part of the numbered pipeline (it can call the API). Run by hand: .venv/bin/python scripts/precompute_qa.py
- Questions: scripts/qa_questions.json. Retrieval and checks: api/ask.py (same code as the live endpoint).
- Cache key = sha256 of model + system prompt + question + retrieved chunk ids and texts. A cached answer is reused;
  the API is called only for a missing key, and only if ANTHROPIC_API_KEY is set (loaded from .env in-process,
  as scripts/check_key.py does). The key is never printed.
- An answer that fails the checks after its retry gets one fresh round (ROUNDS = 2); if that fails too it is kept but flagged (shown with a warning on the site).
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "api"))
sys.path.insert(0, str(ROOT / "scripts"))
import ask  # noqa: E402
from _common import write_json  # noqa: E402

CACHE = ROOT / "data/llm_cache/qa"
ROUNDS = 2


def key(q, chunks):
    h = hashlib.sha256()
    for part in [ask.MODEL, ask.SYSTEM, q] + [c["id"] + "\n" + c["text"] for c in chunks]:
        h.update(part.encode() + b"\x00")
    return h.hexdigest()[:24]


def main():
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
    qs = json.loads((ROOT / "scripts/qa_questions.json").read_text())["questions"]
    CACHE.mkdir(parents=True, exist_ok=True)
    answers, calls = [], 0
    for q in qs:
        chunks = ask.index().search(q)
        k = key(q, chunks)
        rec = None
        for rnd in range(ROUNDS):  # a flagged answer gets one fresh round; every round is cached
            f = CACHE / (f"{k}.json" if rnd == 0 else f"{k}-r{rnd + 1}.json")
            if f.exists():
                rec = json.loads(f.read_text())
            elif not os.environ.get("ANTHROPIC_API_KEY"):
                break
            else:
                out = ask.ask_model(q, chunks)
                calls += 1
                rec = {"key": k, "round": rnd + 1, "question": q, **out, "chunks": ask.public_chunks(chunks)}
                f.write_text(json.dumps(rec, indent=2, sort_keys=True, ensure_ascii=False) + "\n")
            if not rec["flagged"]:
                break
        if rec is None:
            print(f"skip (no key, not cached): {q}")
            continue
        answers.append(rec)
        print(f"{'FLAG' if rec['flagged'] else 'ok  '} {k} {q[:70]}")
    write_json("qa_cache.json", {"schema": 1, "model": ask.MODEL, "answers": answers,
                                 "note": "Precomputed by scripts/precompute_qa.py; answers by an AI model from the cited passages only, checked for citations and numbers."})
    print(f"api calls this run: {calls}")


if __name__ == "__main__":
    main()
