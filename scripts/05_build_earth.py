"""Earth applications -> data/processed/earth_apps.json. Pure checks and templates; no LLM.

Input data/manual/earth_apps.json: the spinoffs the challenge page names, each with
- brief_quote: exact text from the challenge page (docs/ref/challenge_brief.md sec. 1)
- resource_title: the challenge page's Resources entry (its URL and description are read from the brief, not typed)
- related: PSI investigations on the same topic, each with an exact quote from a named PSI metadata field.
Rules: a quote that is not found fails the build. A spinoff with no related investigation says so. We never claim a
spinoff came from a PSI investigation; the challenge page's own descriptions give the decade, which we show.
"""
from __future__ import annotations

import json
import re

from _common import ROOT, write_json

P = ROOT / "data/processed"
ws = lambda s: re.sub(r"\s+", " ", s or "").strip()
BRIEF = ROOT / "docs/ref/challenge_brief.md"


def main():
    text = BRIEF.read_text(encoding="utf-8")
    page = re.search(r"Captured .*? from (https://\S+)", text).group(1)
    s1 = ws(text.split("## 1. Challenge page text (verbatim)")[1].split("\n---")[0])
    sec2 = text.split("## 2. Resources tab (verbatim)")[1].split("\n---")[0]
    res = {}
    for line in sec2.splitlines():
        m = re.match(r"- (.+?) — (https://\S+)(?: — \"(.+)\")?$", line.strip())
        if m:
            res[m.group(1)] = {"title": m.group(1), "url": m.group(2), "description": m.group(3)}
    cat = {i["psi_id"]: i for i in json.loads((P / "catalog.json").read_text())["investigations"]}
    man = json.loads((ROOT / "data/manual/earth_apps.json").read_text())

    def field_text(pid, f):
        return ws((cat[pid]["fields"].get(f) or {}).get("value"))

    # How many investigations mention water mist anywhere in their metadata free text (data-driven, not typed).
    mist = sorted(pid for pid in cat if any(re.search(r"\bwater[- ]mist\b", field_text(pid, f), re.I) for f in ("objective", "approach", "hypothesis", "impacts")))
    out, errors = [], []
    for a in man["applications"]:
        if ws(a["brief_quote"]) not in s1:
            errors.append(f"{a['id']}: brief_quote not on the challenge page")
        for k in ("link_quote", "context_quote"):
            if a.get(k) and ws(a[k]) not in s1:
                errors.append(f"{a['id']}: {k} not on the challenge page")
        r = res.get(a["resource_title"]) if a["resource_title"] else None
        if a["resource_title"] and not r:
            errors.append(f"{a['id']}: resource {a['resource_title']!r} not in the Resources list")
        decade = re.match(r"(\d{4}s)", (r or {}).get("description") or "")
        rel = []
        for x in a["related"]:
            if x["psi_id"] not in cat:
                errors.append(f"{a['id']}: unknown {x['psi_id']}")
                continue
            if ws(x["quote"]) not in field_text(x["psi_id"], x["field"]):
                errors.append(f"{a['id']}: quote not in {x['psi_id']} {x['field']}: {x['quote'][:50]!r}")
            src = cat[x["psi_id"]]["fields"][x["field"]]["source"]
            rel.append({**x, "title": cat[x["psi_id"]]["fields"]["title"]["value"], "doi": cat[x["psi_id"]]["fields"]["doi"].get("value"),
                        "src": {"file": src["file"], "line": src["line"], "key": src["key"]}})
        origin = None
        if decade:
            origin = f"The challenge page's resource note dates this to the {decade.group(1)}." + (
                " The investigations below share its topic; we do not claim they led to it." if rel else "")
        if a["id"] == "water_mist":
            note = (f"{len(mist)} of {len(cat)} PSI combustion investigations mention water mist in their metadata" + (f" ({', '.join(mist)})." if mist else ".")
                    + " The investigations listed studied suppression in other ways (gases, models).")
        elif not rel:
            note = ("No PSI combustion investigation is linked to this in our sources. The resource note describes it as an adaptation of spacesuit technology."
                    if "spacesuit" in ((r or {}).get("description") or "") else "No PSI combustion investigation is linked to this in our sources.")
        else:
            note = None
        out.append({"id": a["id"], "title": a["title"], "theme": a["theme"],
                    "brief_quote": a["brief_quote"], "link_quote": a.get("link_quote"),
                    "source": {"url": r["url"] if r else page, "title": r["title"] if r else "Space Apps 2026 challenge page",
                               "description": (r or {}).get("description"), "where": "challenge page Resources tab" if r else "challenge page text (no resource link given for this one)"},
                    "origin": origin, "note": note, "related": rel,
                    "context": {"quote": a["context_quote"], "link": a["context_link"]} if a.get("context_quote") else None})
    if errors:
        raise SystemExit("FAIL earth apps:\n  " + "\n  ".join(errors))
    write_json("earth_apps.json", {"schema": 1, "challenge_page": page, "applications": out, "water_mist_mentions": mist, "note": man["note"]})
    for a in out:
        print(f"earth      {a['id']:13s} related {len(a['related'])}")


if __name__ == "__main__":
    main()
