"""References: every external resource the project uses -> data/processed/references.json + references.md (repo root).

Generated from what the pipeline and the site actually use, never typed as a free list:
- NASA PSI data: catalog.json (24 investigations; DOI from each ISA-Tab `Comment[DOI]`; files read from our download).
- Reports and papers: data/manual/sources.json (citation, NTRS id/URL, sha256), with the pages cited anywhere in
  data/processed/*.json, data/manual/*.json or web/src/**/*.js (regex "p.N" in strings that name the source).
- Challenge page + resources: docs/ref/challenge_brief.md (URLs parsed from the saved page text).
- Images and video: reference.json (NASA figure) and clips.json (BASS-II clips).
- Software: package.json + node_modules/<pkg>/package.json (version, licence); scripts/requirements.txt and
  requirements.txt + installed package metadata (version, licence).
- Model used by api/ask.py: read from its MODEL constant.
"""
from __future__ import annotations

import importlib.metadata as md
import json
import re
from pathlib import Path

from _common import ROOT, write_json

P = ROOT / "data/processed"
MAN = ROOT / "data/manual"
BRIEF = ROOT / "docs/ref/challenge_brief.md"
load = lambda p: json.loads(Path(p).read_text(encoding="utf-8"))
PAGE = re.compile(r"\bp\.\s?(\d{1,3})\b")
# A string counts as citing a source only if it names it; the BASS-II report is cited as "report" in BASS-II outputs.
MARKERS = {
    "bass2_report": ["report", "Report says", "NASA/TM-20210011385", "Fig. 6", "Figure 6"],
    "saffire_ices2024": ["Saffire VI", "ICES-2024-365", "Table 1"],
    "ntrs_20160001047": ["20160001047"],
    "ntrs_20150010425": ["20150010425"],
}
# Which files may mention a source by these generic markers ("report" in a FLEX file would be wrong).
SCOPE = {"bass2_report": ["bass2_tests.json", "reference.json", "clips.json", "evidence.js", "limits.js", "clips.js"],
         "saffire_ices2024": ["external_tests.json", "evidence.js", "limits.js"],
         "ntrs_20160001047": None, "ntrs_20150010425": None}


def strings(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, dict):
        for v in o.values():
            yield from strings(v)
    elif isinstance(o, list):
        for v in o:
            yield from strings(v)


def nearest_source(text, pos, fname):
    """The source whose marker occurs closest before position pos in text (only sources in scope for this file)."""
    best, at = None, -1
    for sid, marks in MARKERS.items():
        if SCOPE[sid] is not None and fname not in SCOPE[sid]:
            continue
        for mk in marks:
            i = text.rfind(mk, 0, pos)
            if i > at:
                best, at = sid, i
    return best


def structured_pages(o, sid, short, out, file=None):
    if isinstance(o, dict):
        if o.get("short") == short or o.get("source") == sid or o.get("source_id") == sid or (file and o.get("file") == file):
            pg = o.get("printed_page") or o.get("page")
            if isinstance(pg, int):
                out.add(pg)
        for v in o.values():
            structured_pages(v, sid, short, out, file)
    elif isinstance(o, list):
        for v in o:
            structured_pages(v, sid, short, out, file)


def cited_pages(sources):
    texts = {}
    for f in sorted(P.glob("*.json")) + sorted(MAN.glob("*.json")):
        if f.name != "references.json":
            texts[f.name] = load(f)
    js = {f.name: f.read_text(encoding="utf-8") for f in sorted((ROOT / "web/src").rglob("*.js"))}
    out = {}
    for sid, s in sources.items():
        pages = set()
        for name, obj in texts.items():
            structured_pages(obj, sid, s.get("short"), pages, s.get("file"))
        for txt in strings({k: v for k, v in s.items() if k in ("gives", "does_not_give")}):
            pages.update(int(m) for m in PAGE.findall(txt))
        if sid in MARKERS:
            corpus = [(n, t) for n, o in texts.items() for t in strings(o)] + [(n, t) for n, src in js.items() for t in re.findall(r"`[^`]*`|'[^'\n]*'", src)]
            for n, t in corpus:
                for m in PAGE.finditer(t):
                    if nearest_source(t, m.start(), n) == sid:
                        pages.add(int(m.group(1)))
        out[sid] = sorted(pages)
    return out


def npm_pkgs():
    pj = load(ROOT / "package.json")
    rows = []
    for dev, deps in ((False, pj.get("dependencies", {})), (True, pj.get("devDependencies", {}))):
        for name in sorted(deps):
            m = load(ROOT / "node_modules" / name / "package.json")
            rows.append({"name": name, "version": m["version"], "license": m.get("license"), "url": m.get("homepage") or f"https://www.npmjs.com/package/{name}",
                         "use": "build/QA only, not shipped" if dev else "shipped in the web page", "from": "package.json"})
    return rows


def py_pkgs():
    rows, seen = [], set()
    for req, use in ((ROOT / "requirements.txt", "Vercel function (api/)"), (ROOT / "scripts/requirements.txt", "build-time pipeline (scripts/)")):
        for line in req.read_text().splitlines():
            line = line.split("#")[0].strip()
            if not line or "==" not in line:
                continue
            name, ver = line.split("==")
            if name in seen:
                for r in rows:
                    if r["name"] == name:
                        r["use"] += f"; {use}"
                continue
            seen.add(name)
            try:
                m = md.metadata(name)
                lic = m.get("License-Expression") or next((c.split("::")[-1].strip() for c in (m.get_all("Classifier") or []) if c.startswith("License ::")), None) \
                    or ((m.get("License") or "").strip() if 0 < len((m.get("License") or "").strip()) <= 40 else None)
                urls = dict(u.split(", ", 1) for u in (m.get_all("Project-URL") or []) if ", " in u)
                url = urls.get("Homepage") or urls.get("Source") or m.get("Home-page") or f"https://pypi.org/project/{name}/"
            except md.PackageNotFoundError:
                lic, url = None, f"https://pypi.org/project/{name}/"
            rows.append({"name": name, "version": ver, "license": lic, "url": url, "use": use, "from": str(req.relative_to(ROOT))})
    return rows


def model_id():
    src = (ROOT / "api/ask.py").read_text(encoding="utf-8")
    m = re.search(r'^MODEL\s*=\s*"([^"]+)"', src, re.M)
    return m.group(1) if m else None


def brief_links():
    text = BRIEF.read_text(encoding="utf-8")
    page = re.search(r"Captured .*? from (https://\S+)", text).group(1)
    sec2 = text.split("## 2. Resources tab (verbatim)")[1].split("\n---")[0]
    res = []
    for line in sec2.splitlines():
        m = re.match(r"- (.+?) — (https://\S+)(?: — \"(.+)\")?$", line.strip())
        if m:
            res.append({"title": m.group(1), "url": m.group(2), "note": m.group(3)})
    return page, res


def main():
    m = re.search(r"Official challenge video .*?: (https://\S+)", BRIEF.read_text(encoding="utf-8"))
    video_url = m.group(1) if m else None
    cat = load(P / "catalog.json")
    sources = load(MAN / "sources.json")
    ref = load(P / "reference.json")
    clips = load(P / "clips.json")
    earth = load(P / "earth_apps.json") if (P / "earth_apps.json").exists() else None
    pages = cited_pages(sources)
    page_url, resources = brief_links()
    used_res = {u for a in (earth or {}).get("applications", []) for u in [a["source"]["url"]]} | {r["url"] for r in resources if "psi.nasa.gov" in r["url"]}

    psi = []
    for inv in cat["investigations"]:
        f = inv["fields"]
        doi = (f.get("doi") or {}).get("value")
        used = ["ISA-Tab metadata (i_Investigation.txt)"] + [Path(t["file"]).name for t in inv.get("tables", [])]
        psi.append({"psi_id": inv["psi_id"], "title": f["title"]["value"], "doi": doi, "url": f"https://doi.org/{doi}" if doi else None, "files_used": used,
                    "source": f["title"]["source"]})
    clip_list = [{"clip": c["clip"], "test": c["panel2"]["test"] if c.get("panel2") else c.get("test"), "source_name": c["source_name"], "psi_id": "PSI-25"} for c in clips["clips"]]
    papers = []
    for sid, s in sources.items():
        if sid == "challenge_brief":
            continue
        nid = s.get("ntrs_id")
        papers.append({"id": sid, "citation": s["citation"], "short": s["short"], "ntrs_id": nid,
                       "url": f"https://ntrs.nasa.gov/citations/{nid}" if nid else s.get("url"), "pdf_url": s.get("url"),
                       "cited_pages": pages.get(sid, []), "sha256": s.get("sha256")})
    model = model_id()
    out = {
        "schema": 1,
        "psi": {"repository": next(r for r in resources if "psi.nasa.gov" in r["url"]), "investigations": psi,
                "note": "Public NASA Physical Sciences Informatics (PSI) data, downloaded by hand from psi.nasa.gov; each investigation's DOI is its PSI dataset DOI (ISA-Tab Comment[DOI])."},
        "papers": papers,
        "challenge": {"page": {"title": "NASA Space Apps Challenge 2026: Flame in Freefall", "url": page_url, "saved_copy": str(BRIEF.relative_to(ROOT))},
                      "video": {"title": "Official challenge video (embedded on the challenge page)", "url": video_url,
                                "note": "Transcript saved verbatim in docs/ref/challenge_brief.md sec. 3."},
                      "resources_used": [r for r in resources if r["url"] in used_res],
                      "resources_all": resources},
        "media": [{"what": f"NASA Figure 6.10 (image, not digitized): {ref['panel2']['nasa_figure']['source']['doc']}, printed p.{ref['panel2']['nasa_figure']['source']['printed_page']}",
                   "file": f"web/public/{ref['panel2']['nasa_figure']['image']}", "credit": "NASA (public domain U.S. Government work)"}]
                 + [{"what": f"BASS-II flight video, test {c['test']} (trimmed): PSI-25 raw data file {c['source_name']}", "file": f"web/public/{c['clip']}", "credit": "NASA PSI-25 (BASS-II)"} for c in clip_list],
        "software": {"npm": npm_pkgs(), "python": py_pkgs(),
                     "tools": [{"name": "macOS avconvert", "use": "trimming the 3 BASS-II clips (scripts/make_clips.sh)"},
                               {"name": "Google Chrome (headless, via playwright-core)", "use": "screenshots and visual QA only"}]},
        "services": [{"name": "Vercel", "use": "hosting (static site + one Python function), free tier", "url": "https://vercel.com"},
                     {"name": "Anthropic API", "use": f"cited Q&A answers in api/ask.py (model {model})" if model else "cited Q&A (api/ask.py): not wired up yet",
                      "model": model, "url": "https://www.anthropic.com/api"}],
        "ai_statement": "Claude (Anthropic), working in Claude Code, helped build this project: writing the data pipeline, the web page and these notes, "
                        "under the author's direction and review. No number on any chart comes from an AI model: every plotted value is read by deterministic "
                        "code from a NASA file or a cited paper, and each carries its source. Q&A answers are generated by the Anthropic API only from "
                        "retrieved, cited text, and are labelled as AI-generated.",
    }
    write_json("references.json", out)
    (ROOT / "references.md").write_text(to_md(out), encoding="utf-8")
    print(f"references {len(psi)} PSI investigations, {len(papers)} papers, {len(out['media'])} media, "
          f"{len(out['software']['npm']) + len(out['software']['python'])} packages; model {model}")


def to_md(r):
    L = ["# References", "", "Generated by `scripts/05_build_references.py` from what the pipeline and site actually use. Do not edit by hand.", "",
         "## NASA data: Physical Sciences Informatics (PSI)", "", f"Repository: [{r['psi']['repository']['title']}]({r['psi']['repository']['url']}). {r['psi']['note']}", ""]
    L += ["| PSI ID | Investigation | Dataset DOI | Files used |", "|---|---|---|---|"]
    for i in r["psi"]["investigations"]:
        doi = f"[{i['doi']}]({i['url']})" if i["doi"] else "none in metadata"
        L.append(f"| {i['psi_id']} | {i['title']} | {doi} | {'; '.join(i['files_used'])} |")
    L += ["", "## Reports and papers", ""]
    for p in r["papers"]:
        pages = ", ".join(f"p.{x}" for x in p["cited_pages"])
        pg = f" Pages cited: {pages}." if pages else " No page numbers (abstract record)." if p["id"].startswith("ssce") else ""
        ntrs = f"NTRS {p['ntrs_id']}: " if p["ntrs_id"] else ""
        L.append(f"- {p['citation'].rstrip('.')}. {ntrs}<{p['url']}>.{pg}")
    c = r["challenge"]
    L += ["", "## Challenge", "", f"- {c['page']['title']}: <{c['page']['url']}> (text saved in `{c['page']['saved_copy']}`).",
          f"- {c['video']['title']}" + (f": <{c['video']['url']}>" if c['video']['url'] else "") + f". {c['video']['note']}"]
    for x in c["resources_used"]:
        L.append(f"- {x['title']}: <{x['url']}>" + (f" ({x['note']})" if x.get("note") else ""))
    L += ["", "## Images and video", ""] + [f"- {m['what']}. Credit: {m['credit']}. Served as `{m['file']}`." for m in r["media"]]
    L += ["", "## Software", "", "| Package | Version | Licence | Used for |", "|---|---|---|---|"]
    for s in r["software"]["npm"] + r["software"]["python"]:
        L.append(f"| [{s['name']}]({s['url']}) | {s['version']} | {s['license'] or 'see package'} | {s['use']} |")
    L += [""] + [f"- {t['name']}: {t['use']}." for t in r["software"]["tools"]]
    L += ["", "## Services", ""] + [f"- [{s['name']}]({s['url']}): {s['use']}." for s in r["services"]]
    L += ["", "## Use of AI", "", r["ai_statement"], ""]
    return "\n".join(L)


if __name__ == "__main__":
    main()
