"""Retrieval chunks for the cited Q&A -> data/processed/qa_chunks.json. Deterministic, offline, no LLM.

Every chunk has a stable id, a human-readable source and the exact text the model may quote:
- meta:<PSI>:<field>     PSI ISA-Tab free text (Objective, Approach, Hypothesis, Research Impacts), file + line
- report:bass2:p<N>[.k]  BASS-II report pages we cite (printed page N; PDF page = N + 8)
- paper:<id>:p<N>[.k]    cited public-use papers (NTRS 20160001047, NTRS 20150010425), PDF page N
- ntrs:ssce              the SSCE NTRS abstract record
- brief:s1.<k>           the challenge page text (docs/ref/challenge_brief.md sec. 1, verbatim)
- limits:<...>           our Known Limits facts, rendered from pipeline JSON (sources' gives / does-not-give,
                         the O2 sweep, habitat gaps, the headline)
Reference PDFs are gitignored; if one is missing and qa_chunks.json exists, the old chunks for it are kept.
"""
from __future__ import annotations

import json
import re

from _common import BASS2_REPORT, REF, ROOT, write_json

P = ROOT / "data/processed"
OUT = P / "qa_chunks.json"
ws = lambda s: re.sub(r"\s+", " ", s or "").strip()
load = lambda n: json.loads((P / n).read_text(encoding="utf-8"))
MAX = 1100  # characters per chunk (split at sentence ends)
UNREADABLE: list[str] = []

BASS2_PAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 66, 67, 74, 75, 76, 94]   # printed pages: summary + cited pages
# The Saffire VI paper (NTRS 20240002981) is marked "may include copyright material": its page text is NOT chunked.
# Its facts enter as data:saffire:table1 (verified Table 1 values) and the short quotes in sources.json.
PAPERS = {  # id -> (sources.json key, pdf file, pdf pages 1-based); public-use NTRS documents only
    "ntrs20160001047": ("ntrs_20160001047", REF / "NTRS_20160001047_O2_partial_pressure_flammability.pdf", [1, 2, 3]),
    "ntrs20150010425": ("ntrs_20150010425", REF / "NTRS_20150010425_ISS_O2_gas_supply.pdf", [1]),
}


def split(text):
    """Split at sentence ends into pieces of at most MAX characters."""
    sents = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9(])", ws(text))
    out, cur = [], ""
    for s in sents:
        if cur and len(cur) + len(s) + 1 > MAX:
            out.append(cur)
            cur = s
        else:
            cur = f"{cur} {s}".strip()
    if cur:
        out.append(cur)
    return out


def pdf_chunks(prefix, path, pages, label, page_label, offset=0):
    import pypdf
    r = pypdf.PdfReader(str(path))
    out = []
    for pg in pages:
        try:
            text = r.pages[pg + offset - 1].extract_text()
        except pypdf.errors.PyPdfError:   # a stream that will not decompress: the page cannot be searched
            UNREADABLE.append(f"{path.name} p.{pg}")
            continue
        parts = split(text)
        for k, t in enumerate(parts, start=1):
            out.append({"id": f"{prefix}:p{pg}" + (f".{k}" if len(parts) > 1 else ""), "text": t,
                        "source": f"{label}, {page_label} {pg}", "file": str(path.relative_to(ROOT)), "page": pg})
    return out


def keep_old(prefix):
    if not OUT.exists():
        return None
    old = [c for c in json.loads(OUT.read_text())["chunks"] if c["id"].startswith(prefix + ":")]
    return old or None


BRIEF = "Space Apps 2026 challenge page"


def gap_from(h):
    """Primary documents behind one habitat's gap report, in order of first use."""
    out = [BRIEF]
    for x in h["gaps"] + h["covered"]:
        for e in x.get("evidence", []):
            d = (", ".join(str(v) for v in (e.get("doc"), e.get("locator"), e.get("printed_page") and f"p.{e['printed_page']}") if v)
                 if e.get("doc") else f"{e['file'].split('/')[2]} experimental table (PSI)")
            if d not in out and e.get("doc") != BRIEF:
                out.append(d)
    return out


def main():
    sources = json.loads((ROOT / "data/manual/sources.json").read_text())
    chunks, missing = [], []

    cat = load("catalog.json")
    for inv in cat["investigations"]:
        f = inv["fields"]
        for key in ("objective", "approach", "hypothesis", "impacts"):
            v = f.get(key) or {}
            if not v.get("value"):
                continue
            s = v["source"]
            for k, t in enumerate(split(v["value"]), start=1):
                chunks.append({"id": f"meta:{inv['psi_id']}:{key}" + (f".{k}" if len(v['value']) > MAX else ""), "text": t,
                               "source": f"{inv['psi_id']} {f['title']['value']}: PSI metadata {s['key']}", "file": s["file"], "line": s["line"]})

    rep = ROOT / BASS2_REPORT["file"]
    if rep.exists():
        chunks += pdf_chunks("report:bass2", rep, BASS2_PAGES, BASS2_REPORT["doc"], "printed p.", BASS2_REPORT["pdf_page_offset"])
    elif old := keep_old("report:bass2"):
        chunks += old
        missing.append(BASS2_REPORT["file"])
    for pid, (sid, path, pages) in PAPERS.items():
        if path.exists():
            chunks += pdf_chunks(f"paper:{pid}", path, pages, sources[sid]["short"], "PDF p.")
        elif old := keep_old(f"paper:{pid}"):
            chunks += old
            missing.append(str(path.relative_to(ROOT)))

    ssce = json.loads((REF / "SSCE_NTRS_20050177200.json").read_text())
    abstract = ssce.get("abstract") or ""
    for k, t in enumerate(split(abstract), start=1):
        chunks.append({"id": f"ntrs:ssce.{k}", "text": t, "source": sources["ssce_ntrs1995"]["short"] + " (abstract)", "file": "docs/ref/SSCE_NTRS_20050177200.json"})

    brief = (ROOT / "docs/ref/challenge_brief.md").read_text(encoding="utf-8")
    s1 = brief.split("## 1. Challenge page text (verbatim)")[1].split("\n---")[0]
    paras = [p for p in (ws(x) for x in s1.split("\n")) if len(p) > 60]
    for k, t in enumerate(paras, start=1):
        chunks.append({"id": f"brief:s1.{k}", "text": t, "source": "Space Apps 2026 challenge page (verbatim)", "file": "docs/ref/challenge_brief.md"})

    # Our Known Limits facts, rendered from pipeline JSON (the same facts the Known Limits tab shows).
    for sid, s in sources.items():
        txt = f"Flame Frontier's notes on {s['short']}. What it gives: {s.get('gives', '')} What it does not give, in Flame Frontier's reading: " + " ".join(s.get("does_not_give", []))
        chunks.append({"id": f"limits:source:{sid}", "text": ws(txt), "source": f"Flame Frontier Known Limits: {s['short']}", "file": "data/manual/sources.json",
                       "derived_from": [s["short"]]})
    sweep = load("o2_sweep.json")
    for r in sweep["rows"]:
        chunks.append({"id": f"limits:o2:{r['psi_id']}:{r['table'].replace(' ', '_')}",
                       "text": ws(f"{r['psi_id']} {r['table']}, column \"{r['column']}\": verdict {r['verdict'].replace('_', ' ')}. Evidence: \"{r['evidence_quote']}\". {r['reading']}"),
                       "source": "Flame Frontier Known Limits: whose oxygen?", "file": sweep["source"],
                       "derived_from": [f"{r['psi_id']} {r['table']} (PSI), column \"{r['column']}\"", f"{r['psi_id']} {r['evidence_where']}" if r["evidence_where"] != "brief" else BRIEF]})
    gaps = load("gaps.json")
    for h in gaps["habitats"]:
        lines = [f"{h['habitat']['name']} target: {h['window']}, {h['habitat']['gravity']} gravity. {h['tested']['solids_inside']} solid-material tests in this window."]
        lines += [g["text"] + (" " + g["detail"] if g.get("detail") else "") for g in h["gaps"]] + [c["text"] for c in h["covered"]] + h["context"]
        chunks.append({"id": f"limits:gaps:{h['habitat']['id']}", "text": ws(" ".join(lines)), "source": f"Flame Frontier habitat gap report: {h['habitat']['name']}", "file": "data/processed/gaps.json",
                       "derived_from": gap_from(h)})
    ext = load("external_tests.json")
    saf = next(t for t in ext["tests"] if t["kind"] == "point")["source"]
    saf_from = f"{saf['short']}, {saf['locator']}, p.{saf['printed_page']}"
    zone = [t for t in ext["tests"] if t["in_moon_zone"] and t["kind"] == "point"]
    chunks.append({"id": "limits:headline", "file": "data/processed/external_tests.json", "source": "Flame Frontier headline (template over external_tests.json)",
                   "derived_from": [saf_from, BRIEF],
                   "text": f"Of the solid-material space fire tests in our sources, only {len(zone)} burned in Moon-base air ("
                           + "; ".join(f"Saffire {t['sample']}, {t['material']}, {t['o2_as_stated'][0]} {t['o2_basis']} at {t['pressure_conversion'][0]}, {t['flow_cm_s']} cm/s" for t in zone)
                           + "), none in partial gravity. Moon-base air means at least 30% O2 at 10.2 psi (70.33 kPa) or less, from the challenge page."})
    earth = load("earth_apps.json")
    for a in earth["applications"]:
        parts = [f"Earth application named on the challenge page: {a['title']}. Challenge page: \"{a['brief_quote']}\"."]
        if a["source"]["description"]:
            parts.append(f"{a['source']['title']} (NASA Spinoff): \"{a['source']['description']}\"")
        parts += [x for x in (a["origin"], a.get("link_quote"), a["note"]) if x]
        parts += [f"Related: {x['psi_id']} {x['title']}: \"{x['quote']}\"." for x in a["related"]]
        chunks.append({"id": f"limits:earth:{a['id']}", "file": "data/processed/earth_apps.json", "source": f"Flame Frontier On Earth: {a['title']}", "text": ws(" ".join(parts)),
                       "derived_from": [BRIEF] + ([f"NASA Spinoff: {a['source']['title']}"] if a["source"]["description"] else []) + [f"{x['psi_id']} PSI metadata" for x in a["related"]]})

    # PDF tables flatten into one long row-major line; restate verified table rows one sentence per test.
    pts = [t for t in ext["tests"] if t["kind"] == "point"]
    src = pts[0]["source"]
    chunks.append({"id": "data:saffire:table1", "file": "data/processed/external_tests.json", "page": src["printed_page"],
                   "source": f"{src['short']}, {src['locator']}, p.{src['printed_page']} (rows restated one per test; values checked against the PDF)",
                   "text": " ".join(f"Saffire {t['sample']} ({t['mission']}): {t['material']}, ambient pressure {t['pressure_conversion'][0]}, oxygen {t['o2_as_stated'][0]} {t['o2_basis']}, "
                                    f"air flow {t['flow_cm_s']:g} cm/s {t['flow_direction'].lower()}" + (", in Moon-base air." if t["in_moon_zone"] else ".") for t in pts)})
    cfig = load("cfig_tests.json")
    cz = cfig["moon_zone"]
    chunks.append({"id": "limits:cfig", "file": "data/processed/cfig_tests.json", "source": "Flame Frontier Known Limits: ACME CFI-G",
                   "derived_from": ["PSI-159 CFI-G experimental table (PSI)", BRIEF],
                   "text": ws(f"ACME CFI-G normal flames: {cz['count']} of {cfig['count']} tests ran with chamber O2 {cz['o2_range_pct'][0]}–{cz['o2_range_pct'][1]}% at {', '.join(map(str, cz['pressure_kpa']))} kPa (Moon-base air); they are gas flames, not solids. "
                              f"{cfig['evidence']['brief_reading']} Inverse flames: {cfig['evidence']['inverse']['tests']} tests, burner oxidizer stream up to {cfig['evidence']['inverse']['xo2_max_pct']}% O2, which is not an atmosphere.")})

    # Where two sources disagree, one chunk states both (quotes checked against the chunk texts) so answers say so.
    import csv
    by_id = {c["id"]: c for c in chunks}
    nrows = load("bass2_tests.json")["count"]
    for r in csv.DictReader(open(ROOT / "data/manual/source_disagreements.csv", newline="", encoding="utf-8")):
        for side in ("a", "b"):
            cid, q = r[f"{side}_chunk"], r[f"{side}_quote"].format(bass2_rows=nrows)
            if cid and ws(q) not in by_id[cid]["text"]:
                raise SystemExit(f"FAIL disagreement {r['id']}: quote not in {cid}: {q!r}")
        chunks.append({"id": f"limits:disagree:{r['id']}", "file": "data/manual/source_disagreements.csv",
                       "source": f"Flame Frontier Known Limits: sources disagree ({r['topic']})",
                       "derived_from": [by_id[r[f"{x}_chunk"]]["source"] for x in "ab" if r[f"{x}_chunk"]] + ([] if r["b_chunk"] else ["PSI-25 experimental table (PSI)"]),
                       "text": f"Sources disagree on {r['topic']}. {r['reading'].format(bass2_rows=nrows)}"})

    # Tier: primary = NASA/challenge text (or a NASA table restated row by row); derived = this site's own summaries.
    # Derived passages rank below primary ones in retrieval and always name what they were derived from.
    for c in chunks:
        c["tier"] = "derived" if c["id"].startswith("limits:") else "primary"
        if c["tier"] == "derived" and not c.get("derived_from"):
            raise SystemExit(f"FAIL derived chunk without derived_from: {c['id']}")
    ids = [c["id"] for c in chunks]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        raise SystemExit(f"FAIL duplicate chunk ids: {sorted(dup)[:5]}")
    import sys
    sys.path.insert(0, str(ROOT / "api"))
    import ask  # the browser's offline search uses the same stopwords, synonyms and top-k as the server
    retrieval = {"stopwords": sorted(ask._STOP), "synonyms": ask.SYNONYMS, "top_k": ask.TOP_K, "k1": 1.5, "b": 0.75, "synonym_weight": 0.5, "derived_weight": ask.DERIVED_WEIGHT}
    write_json("qa_chunks.json", {"schema": 1, "count": len(chunks), "retrieval": retrieval, "chunks": chunks, "kept_from_previous_build": missing, "unreadable_pages": UNREADABLE})
    print(f"chunks     {len(chunks)} chunks; unreadable {UNREADABLE}" + (f" (kept old text for missing {missing})" if missing else ""))


if __name__ == "__main__":
    main()
