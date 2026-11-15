"""Glossary (data/manual/glossary.json) -> data/processed/glossary.json.

Every quote must appear word for word (whitespace and quote marks normalised) in its source: a Q&A passage in
qa_chunks.json (built by 06_build_chunks.py) or a committed file. The stretch-rate entry's formula is checked
against reference.json (eq. 6.1). A failed check stops the build: no definition is shown without its source."""
import json
import re
import sys

from _common import PROCESSED, ROOT, write_json


def norm(s):
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"').replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", s).strip().lower()


def main():
    g = json.loads((ROOT / "data/manual/glossary.json").read_text(encoding="utf-8"))
    chunks = {c["id"]: c for c in json.loads((PROCESSED / "qa_chunks.json").read_text(encoding="utf-8"))["chunks"]}
    ref = json.loads((PROCESSED / "reference.json").read_text(encoding="utf-8"))
    bad, out = [], []
    ids = [t["id"] for t in g["terms"]]
    if len(set(ids)) != len(ids):
        bad.append("duplicate glossary ids")
    for t in g["terms"]:
        srcs = []
        for q in t.get("quotes", []):
            if "chunk" in q:
                c = chunks.get(q["chunk"])
                text = c["text"] if c else ""
                where = f'{c["source"]}' if c else q["chunk"]
            else:
                text = (ROOT / q["file"]).read_text(encoding="utf-8")
                where = q["file"]
            if norm(q["quote"]) not in norm(text):
                bad.append(f'{t["id"]}: quote not found in {q.get("chunk") or q.get("file")}: "{q["quote"]}"')
            srcs.append(f'{q["label"]}: "{q["quote"]}" ({where})')
        if t.get("kind") == "fact" and not srcs:
            bad.append(f'{t["id"]}: a factual definition needs at least one checked quote')
        if t.get("equation_check") == "panel2":
            a_def = "(3/2)(U/r)(r/r0)^0.5"
            hay = json.dumps(ref["panel2"], ensure_ascii=False)
            if a_def not in t["def"] or "(3/2)" not in hay.replace(" ", ""):
                bad.append(f'{t["id"]}: stretch-rate formula does not match reference.json panel2')
        out.append({"id": t["id"], "term": t["term"], "plain": t["plain"], "def": t["def"], "kind": t["kind"],
                    "src": " | ".join(srcs) if srcs else t["kind"]})
    if bad:
        print("\n".join("FAIL " + b for b in bad)); sys.exit(1)
    write_json("glossary.json", {"schema": 1, "terms": {x["id"]: x for x in out}, "sources": g["sources"], "note": g["note"]})


if __name__ == "__main__":
    main()
