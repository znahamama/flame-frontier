"""PSI investigation catalog from ISA-Tab metadata on disk -> data/processed/catalog.json.

Pure rules, no LLM. Every card field is a verbatim metadata value with {file, line, key}.
- data/raw/PSI-NN/*/i_Investigation.txt: ISA-Tab, tab-separated, quoted multi-line cells (csv.reader).
  Content lives in the STUDY section; the INVESTIGATION section is empty in every file we have.
- "Test-level data available?" comes from the files actually on disk (data/raw/PSI-NN/*Experimental table*.csv),
  with the kind of table (per-test / summary) from data/manual/psi_tables.csv. A table on disk that is not
  classified there is reported as "unreviewed", never guessed.
- The gap list comes from data/manual/brief_investigations.csv: investigations the challenge brief names, each with
  an exact quote checked against docs/ref/challenge_brief.md. The total of 24 is quoted from the challenge video.
Contacts: names and roles only. Emails, phones, addresses and fax are never read into the output.
"""
from __future__ import annotations

import csv
import re
import sys

from _common import ROOT, write_json

RAW = ROOT / "data/raw"
BRIEF = ROOT / "docs/ref/challenge_brief.md"
rel = lambda p: str(p.relative_to(ROOT))

FIELDS = [  # (output key, ISA key, label)
    ("title", "Study Title", "Title"),
    ("doi", "Comment[DOI]", "DOI"),
    ("platform", "Comment[Flight Platform]", "Flight platform"),
    ("center", "Comment[Managing NASA Center]", "Managing NASA center"),
    ("hardware", "Comment[Experiment Hardware]", "Hardware"),
    ("area", "Comment[Research Area]", "Research area"),
    ("subarea", "Comment[SubResearch Area]", "Sub-area"),
    ("released", "Study Public Release Date", "Public release"),
    ("objective", "Comment[Objective]", "Objective"),
    ("approach", "Comment[Approach]", "Approach"),
    ("hypothesis", "Comment[Hypothesis]", "Hypothesis"),
    ("impacts", "Comment[Research Impacts]", "Research impacts"),
]
LISTS = {"keywords": "Study Design Type"}
PEOPLE = ["Study Person First Name", "Study Person Last Name", "Study Person Roles"]
PUBS = ["Study Publication Title", "Study Publication DOI", "Study Publication Status", "Comment[Study Publication Link]"]

problems: list[str] = []


def read_isa(path):
    """{key: (cells, line)} for the STUDY section; line = first physical line of the record."""
    out, section, start = {}, None, 1
    with open(path, encoding="utf-8-sig", newline="") as f:
        rd = csv.reader(f, delimiter="\t")
        for row in rd:
            line, start = start, rd.line_num + 1
            if not row or not row[0]:
                continue
            k = row[0]
            if k.isupper():
                section = k
                continue
            if section and section.startswith("STUDY"):
                out[k] = ([c.strip() for c in row[1:]], line)
    return out


def table_info(folder, kinds):
    tabs = []
    for p in sorted(folder.glob("*Experimental table*.csv")):
        raw = p.read_bytes()
        enc = "utf-8-sig"
        try:
            txt = raw.decode(enc)
        except UnicodeDecodeError:
            enc, txt = "cp1252", raw.decode("cp1252")
        rows = [r for r in csv.reader(txt.splitlines()) if any(c.strip() for c in r)]
        key = f"{folder.name}/{p.name}"
        k = kinds.get(key)
        pat = k["test_row_pattern"] if k else ""
        test_rows = sum(bool(re.match(pat, r[0].strip())) for r in rows[1:]) if pat else len(rows) - 1
        tabs.append({"file": rel(p), "encoding": enc, "data_rows": len(rows) - 1, "test_rows": test_rows,
                     "test_row_pattern": pat or None, "columns": [c.strip() for c in rows[0]],
                     "kind": k["kind"] if k else "unreviewed", "kind_reason": k["reason"] if k else "Not yet classified in data/manual/psi_tables.csv."})
    return tabs


def main():
    kinds = {r["file"]: r for r in csv.DictReader(open(ROOT / "data/manual/psi_tables.csv", newline=""))}
    cards = []
    for folder in sorted(RAW.glob("PSI-*"), key=lambda p: int(p.name.split("-")[1])):
        isas = sorted(folder.glob("*/i_Investigation.txt"))
        if len(isas) != 1:
            problems.append(f"{folder.name}: {len(isas)} i_Investigation.txt files")
            continue
        path = isas[0]
        d = read_isa(path)
        src = lambda key: {"file": rel(path), "line": d[key][1], "key": key}
        first = lambda key: next((c for c in d.get(key, ([], 0))[0] if c), None)
        sid = first("Study Identifier")
        if sid != folder.name:
            problems.append(f"{folder.name}: metadata Study Identifier is {sid!r}")
        card = {"psi_id": folder.name, "study_identifier": {"value": sid, "source": src("Study Identifier")}, "fields": {}}
        for out_key, key, label in FIELDS:
            v = first(key)
            card["fields"][out_key] = {"label": label, "value": v, "source": src(key) if key in d else None}
        for out_key, key in LISTS.items():
            card[out_key] = {"value": [c for c in d.get(key, ([], 0))[0] if c], "source": src(key) if key in d else None}
        # people: names + roles, zipped by column position (ISA-Tab parallel arrays)
        cols = [d.get(k, ([], 0))[0] for k in PEOPLE]
        n = max(map(len, cols))
        people = []
        for i in range(n):
            fn, ln, role = (c[i] if i < len(c) else "" for c in cols)
            if fn or ln:
                people.append({"name": f"{fn} {ln}".strip(), "role": role or None})
        card["people"] = {"value": people, "source": src("Study Person Last Name")}
        card["pi"] = {"value": [p["name"] for p in people if p["role"] == "Principal Investigator (PI)"],
                      "source": src("Study Person Roles")}
        cols = [d.get(k, ([], 0))[0] for k in PUBS]
        pubs = []
        for i in range(max(map(len, cols))):
            t, doi, status, link = (c[i] if i < len(c) else "" for c in cols)
            if t:
                pubs.append({"title": t, "doi": doi or None, "status": status or None, "link": link or None})
        card["publications"] = {"value": pubs, "source": src("Study Publication Title")}
        card["tables"] = table_info(folder, kinds)
        per_test = [t for t in card["tables"] if t["kind"] == "per_test"]
        card["test_level"] = ("yes" if per_test else "summary only" if card["tables"] else "no")
        card["test_rows"] = sum(t["test_rows"] for t in per_test)
        card["summary_rows"] = sum(t["data_rows"] for t in card["tables"] if t["kind"] == "summary")
        card["metadata_dir"] = rel(path.parent)
        cards.append(card)

    # PSI Combustion Science index (transcribed from psi.nasa.gov by the user): the 24 slots of the gap strip.
    idx_file = ROOT / "data/manual/psi_combustion_index.csv"
    index = list(csv.DictReader(open(idx_file, newline="", encoding="utf-8-sig")))
    comb = [r for r in index if r["research_area"] == "Combustion Science"]
    other = [r for r in index if r["research_area"] != "Combustion Science"]
    by_id = {c["psi_id"]: c for c in cards}
    slots = []
    for line, r in enumerate(index, start=2):
        if r["research_area"] != "Combustion Science":
            continue
        c = by_id.get(r["psi_id"])
        title_match = None
        if c:
            c["index_type"] = {"value": r["type"], "source": {"file": rel(idx_file), "line": line, "key": "type"}}
            mt = re.sub(r"\W+", " ", (c["fields"]["title"]["value"] or "").lower()).strip()
            it = re.sub(r"\W+", " ", r["title"].lower()).strip()
            title_match = it.startswith(mt) or mt in it
            if not title_match:
                problems.append(f"{r['psi_id']}: index title {r['title']!r} vs metadata {c['fields']['title']['value']!r}")
        slots.append({"psi_id": r["psi_id"], "title": r["title"], "type": r["type"], "on_disk": bool(c),
                      "test_level": c["test_level"] if c else None, "source": {"file": rel(idx_file), "line": line}})
    not_in_index = sorted(set(by_id) - {r["psi_id"] for r in comb})
    for c in cards:
        if c["psi_id"] in not_in_index:
            problems.append(f"{c['psi_id']} is on disk but not in the Combustion Science index")
        if c["fields"]["area"]["value"] != "Combustion Science":
            problems.append(f"{c['psi_id']}: metadata Research Area is {c['fields']['area']['value']!r}")

    # Gap list: investigations named in the brief, matched to what is on disk by hand-checked PSI ID only.
    brief = re.sub(r"\s+", " ", BRIEF.read_text())
    named = []
    have = {c["psi_id"] for c in cards}
    for r in csv.DictReader(open(ROOT / "data/manual/brief_investigations.csv", newline="")):
        if re.sub(r"\s+", " ", r["quote"]) not in brief:
            problems.append(f"brief quote not found for {r['name']}: {r['quote']!r}")
        if r["psi_id"] and r["psi_id"] not in have:
            problems.append(f"{r['name']} mapped to {r['psi_id']}, which is not on disk")
        named.append({"name": r["name"], "psi_id": r["psi_id"] or None, "on_disk": bool(r["psi_id"]),
                      "quote": r["quote"], "note": r["note"] or None})
    unmapped = sorted(have - {n["psi_id"] for n in named if n["psi_id"]})
    total_quote = "you will see 24 investigations with 12 terabytes of"
    if total_quote not in brief:
        problems.append("24-investigation quote not found in brief")
    if len(comb) != 24:
        problems.append(f"index lists {len(comb)} Combustion Science investigations; the challenge video says 24")

    if problems:
        print("\n".join("FAIL " + p for p in problems))
        sys.exit(1)
    write_json("catalog.json", {
        "schema": 1, "investigations": cards,
        "coverage": {
            "combustion_total": len(comb),
            "index_source": {"file": rel(idx_file), "doc": "PSI Combustion Science listing (psi.nasa.gov), transcribed 2026-11-14"},
            "index_rows_not_combustion": [{"psi_id": r["psi_id"], "title": r["title"], "research_area": r["research_area"]} for r in other],
            "slots": slots,
            "combustion_total_source": {"doc": "Official challenge video transcript", "file": rel(BRIEF), "locator": "sec. 3, [5:52]", "quote": total_quote},
            "on_disk": len(cards),
            "named_in_brief": named,
            "on_disk_not_named_in_brief": unmapped,
            "brief_source": {"doc": "NASA Space Apps 2026 challenge page, Flame in Freefall", "file": rel(BRIEF), "locator": "sec. 1"},
            "note": "Slots follow the PSI Combustion Science index; its count matches the 24 in the challenge video.",
        },
    })


if __name__ == "__main__":
    main()
