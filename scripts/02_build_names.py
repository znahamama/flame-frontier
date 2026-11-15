"""Short display names for the 24 PSI combustion investigations -> data/processed/names.json.

Order of preference (no name is invented):
  1. the name the challenge page uses (data/manual/brief_investigations.csv, quotes checked by 02_clean_catalog.py),
  2. the acronym PSI prints after the title in its listing (data/manual/psi_combustion_index.csv, "Title(ACRONYM)"),
  3. for the 5 ground studies PSI gives no acronym: a short label in data/manual/short_labels.csv, built only from words
     of the PSI title or from another investigation's PSI acronym (checked here), and marked as our label in the UI.
Display only: no number, ranking or claim depends on these names."""
import csv
import re
import sys

from _common import ROOT, write_json

M = ROOT / "data" / "manual"


def main():
    index = {r["psi_id"]: r for r in csv.DictReader(open(M / "psi_combustion_index.csv", newline="", encoding="utf-8"))
             if r["research_area"] == "Combustion Science"}
    brief = {}
    for r in csv.DictReader(open(M / "brief_investigations.csv", newline="", encoding="utf-8")):
        brief.setdefault(r["psi_id"], []).append(r)
    labels = {r["psi_id"]: r for r in csv.DictReader(open(M / "short_labels.csv", newline="", encoding="utf-8"))}
    acr = {}
    for pid, r in index.items():
        m = re.search(r"\(([^()]+)\)\s*$", r["title"])
        acr[pid] = m.group(1).strip() if m else None
    known = {a.lower() for a in acr.values() if a}
    out, bad = {}, []
    for pid, r in index.items():
        title = re.sub(r"\s*\([^()]+\)\s*$", "", r["title"]).strip()
        if pid in brief:
            short = " / ".join(x["name"] for x in brief[pid])
            out[pid] = {"short": short, "title": title, "basis": "challenge_page",
                        "from": f'challenge page: "{brief[pid][0]["quote"]}"'}
        elif acr[pid]:
            short = acr[pid].replace("/", " ")   # "ACME/Flame Design" -> "ACME Flame Design"
            out[pid] = {"short": short, "title": title, "basis": "psi_acronym", "from": f'PSI listing: "{r["title"]}"'}
        elif pid in labels:
            short = labels[pid]["label"]
            words = re.findall(r"[a-z]+", short.lower())
            tw = set(re.findall(r"[a-z]+", title.lower())) | {w.rstrip("s") for w in re.findall(r"[a-z]+", title.lower())}
            miss = [w for w in words if w not in tw and w not in known and not any(t.startswith(w) for t in tw)]
            if miss:
                bad.append(f"{pid}: label words not in the PSI title or a PSI acronym: {miss}")
            out[pid] = {"short": short, "title": title, "basis": "our_label", "from": labels[pid]["note"]}
        else:
            bad.append(f"{pid}: no name source")
    if len(out) != 24:
        bad.append(f"expected 24 investigations, got {len(out)}")
    shorts = [v["short"] for v in out.values()]
    if len(set(shorts)) != len(shorts):
        bad.append("duplicate short names")
    if bad:
        print("\n".join("FAIL " + b for b in bad)); sys.exit(1)
    write_json("names.json", {"schema": 1, "names": dict(sorted(out.items(), key=lambda kv: int(kv[0][4:]))),
                              "note": "Short display names: the challenge page's name where it gives one, else the acronym PSI prints after the title, else (5 ground studies) our label from the title's words."})


if __name__ == "__main__":
    main()
