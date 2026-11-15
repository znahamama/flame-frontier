"""Flame Sandbox -> data/processed/sandbox.json. Pure checks and data packing; no LLM, no physics.

The sandbox tab draws a TEACHING MODEL of a candle flame (Three.js). The picture computes nothing. Everything the tab
states as a number, verdict or badge comes from this file, which is built from the same processed data as the charts:
- quotes: exact substrings of the challenge page (docs/ref/challenge_brief.md sec. 1); a mismatch fails the build.
- video: the official challenge video segment the flame model follows (2:37-3:12); the timestamps must exist in the
  verbatim transcript (sec. 3) and the URL is read from the brief header, never typed.
- presets: habitat windows from gaps.json (each with its quoted source), Earth sea level from reference.json.
- tests: the solid-material points Panel 1 plots (Saffire per-test points + BASS-II), via the gaps builder's
  solid_points(), so the sandbox and the Habitat Gaps tab count the same set. SSCE stays a range ("possible").
- boundary: BASS-II eq. 6.1 constants and its tested stretch-rate range from reference.json (Panel 2).
- clips: the three BASS-II flight clips with the conditions their PSI rows record (clips.json, bass2_tests.json).
- rules: the tolerances the tab uses to say "near", "match" and "thin". They are OUR display rules, shown on the tab.
"""
from __future__ import annotations

import importlib.util
import json
import re
from math import exp

from _common import ROOT, PSI_TO_KPA, write_json

P = ROOT / "data/processed"
load = lambda n: json.loads((P / n).read_text(encoding="utf-8"))
ws = lambda s: re.sub(r"\s+", " ", s or "").strip()
BRIEF = ROOT / "docs/ref/challenge_brief.md"

_spec = importlib.util.spec_from_file_location("gaps", ROOT / "scripts/05_build_gaps.py")
gaps_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gaps_mod)

QUOTES = {
    "candle": "Instead of a flickering teardrop, a candle flame becomes a ghostly blue sphere reliant on diffusion for its oxygen.",
    "buoyancy": "Compared to Earth, flames in free fall (i.e., in microgravity) are often dramatically different because of the absence of buoyancy and thus rising hot gases.",
    "flow": "Flammability is highly dependent on oxygen concentration, and air flow is also important in microgravity.",
    "partial": "there is currently no partial-gravity combustion data available in PSI",
    "bound": "Microgravity and normal-gravity results could bound what occurs at intermediate gravity levels.",
    "future": "We expect such data will be added in the future, for example from the Lunar-g Combustion Investigation (LUCI) and the Flammability of Materials on the Moon (FM2) experiment.",
    "mars": "bases on the lunar and Martian surfaces",
    "moon": "The intermediate oxygen concentration used on the Moon will likely be 30% or greater, with a corresponding pressure of 10.2 psi or less.",
}
# Our summary of the video segment (brief sec. 6, labelled there as OUR interpretation): shown as a summary, never as a quote.
VIDEO = {"from": "2:37", "to": "3:12", "start_s": 157}

# Display rules (ours). The tab prints them in "How this panel decides".
RULES = {
    "near_o2_pts": 2.0,        # a solid test is "near" your point if within +/-2 percentage points O2 ...
    "near_p_kpa": 5.0,         # ... and +/-5 kPa total pressure
    "flow_tol_cm_s": 2.0,      # a recorded flow "matches" yours within +/-2 cm/s
    "thin_max": 2,             # <=2 tests, flows or materials = "thin" (same threshold as the Habitat Gaps rules)
    "clip_o2_pts": 1.0,        # a filmed test "matches" if its initial O2 is within +/-1 point ...
    "clip_flow_cm_s": 2.0,     # ... one of its recorded flows within +/-2 cm/s, microgravity, and pressure in the BASS-II window
}


def main():
    text = BRIEF.read_text(encoding="utf-8")
    s1 = ws(text.split("## 1. Challenge page text (verbatim)")[1].split("\n---")[0])
    s3 = text.split("## 3. Official challenge video transcript")[1].split("\n---")[0]
    s6 = text.split("## 6. What this means for Flame Frontier")[1]
    errors = [f"quote {k!r} not on the challenge page" for k, q in QUOTES.items() if ws(q) not in s1]
    for ts in (VIDEO["from"], VIDEO["to"]):
        if f"[{ts}]" not in s3:
            errors.append(f"video timestamp [{ts}] not in the verbatim transcript")
    m = re.search(r"Official challenge video .*?: (https://www\.youtube\.com/watch\?v=[\w-]+)", text)
    if not m:
        errors.append("challenge video URL not found in the brief header")
    summ = re.search(r"Microgravity flame appearance \(video, 2:37–3:12\): (.+)", s6)
    if not summ:
        errors.append("our video summary (brief sec. 6) not found")

    ref, gaps, ext, bass2, clips, rank = (load(n) for n in ("reference.json", "gaps.json", "external_tests.json", "bass2_tests.json", "clips.json", "ranking.json"))
    p1, p2 = ref["panel1"], ref["panel2"]
    hab = {h["habitat"]["id"]: h for h in gaps["habitats"]}
    iss = hab["iss"]["habitat"]
    srcs = rank["sources"]

    def tsrc(t):  # target source -> short display string
        s = srcs.get(t["source"], {})
        return {"short": s.get("short", t["source"]), "page": t.get("page"), "quote": t["quote"]}

    # Presets. A habitat preset sits at the brief's stated limit (Moon: 30% at 10.2 psi; suit: 100% at 4.3 psi);
    # ISS at its stated set point (21% O2, 101.4 kPa, quoted in the ISS O2 source). Earth: brief's 14.7 psi + the same 21%.
    iss_o2_quote = hab["iss"]["target_sources"]["o2"]
    if "21% O2, 101.4 kPa" not in iss_o2_quote["quote"]:
        errors.append("ISS set point '21% O2, 101.4 kPa' not in the ISS O2 quote")
    presets = [
        {"id": "earth", "name": "Earth sea level", "gravity": "earth", "o2": 21.0, "p_kpa": p1["earth_sea_level"]["p_kpa"], "flow": 0.0, "habitat": None,
         "sources": [{"what": "pressure", "short": "Space Apps 2026 challenge page", "quote": "the Earth’s pressure at sea level is 14.7 psi"},
                     {"what": "21% O2", "short": tsrc(iss_o2_quote)["short"], "page": iss_o2_quote.get("page"), "quote": "The ISS aims to operate at the 21% O2, 101.4 kPa (14.7 psia) point"}]},
        {"id": "iss", "name": "ISS cabin", "gravity": "micro", "o2": 21.0, "p_kpa": 101.4, "flow": 0.0, "habitat": "iss",
         "sources": [{"what": "set point", **tsrc(iss_o2_quote)}]},
        {"id": "moon_base", "name": "Moon base", "gravity": "moon", "o2": hab["moon_base"]["habitat"]["o2_pct"][0], "p_kpa": hab["moon_base"]["habitat"]["p_kpa"][1], "flow": 0.0, "habitat": "moon_base",
         "sources": [{"what": "limit", **tsrc(hab["moon_base"]["target_sources"]["o2"])}]},
        {"id": "rover", "name": "Pressurized rover", "gravity": "moon", "o2": hab["rover"]["habitat"]["o2_pct"][0], "p_kpa": hab["rover"]["habitat"]["p_kpa"][1], "flow": 0.0, "habitat": "rover",
         "sources": [{"what": "same window as the Moon base", **tsrc(hab["rover"]["target_sources"]["o2"])}]},
        {"id": "spacesuit", "name": "Spacesuit", "gravity": "moon", "o2": hab["spacesuit"]["habitat"]["o2_pct"][0], "p_kpa": hab["spacesuit"]["habitat"]["p_kpa"][0], "flow": 0.0, "habitat": "spacesuit",
         "sources": [{"what": "suit", **tsrc(hab["spacesuit"]["target_sources"]["o2"])}]},
    ]
    if "14.7 psi" not in s1 or "the Earth’s pressure at sea level is 14.7 psi" not in s1:
        errors.append("Earth 14.7 psi quote not on the challenge page")

    # Solid tests: exactly the set the Habitat Gaps tab counts. Gravity: every one is microgravity (gaps.json rule).
    solids = gaps_mod.solid_points(ext, bass2)
    tests = []
    for s in solids:
        flows = sorted({s["flow"]} if s.get("flow") is not None else set(s.get("flows", [])))
        src = s["src"]
        tests.append({"id": s["id"], "material": s["material"], "o2": s["o2"], "p_kpa": round(s["p"], 2), "flows": flows,
                      "src": ", ".join(str(x) for x in [src.get("doc"), src.get("locator"), src.get("printed_page") and f"p.{src['printed_page']}",
                                                         src.get("file"), src.get("line") and f"line {src['line']}"] if x)})
    ssce = [{"material": t["material"], "mission": t["mission"], "o2_levels": t["o2_pct"], "p_kpa": t["pressure_kpa"],
             "src": f"{t['source']['short']}, {t['source'].get('locator') or ''}".rstrip(", ")} for t in ext["tests"] if t["kind"] != "point"]

    # Boundary: Panel 2's eq. 6.1, at the rod radius r0 (so a = 1.5 U / r0). Applies only in microgravity and at BASS-II's
    # stated 1 atm; we accept pressures inside the ISS cabin window (BASS-II flew in the ISS cabin; pressure not logged per test).
    lo, hi = p2["tested_a_range"]
    r0 = p2["r0_cm"]
    boundary = {"equation": p2["equation"], "r0_cm": r0, "a_formula": "a = (3/2)(U/r0), rod radius r = r0", "tested_a_range": [lo, hi],
                "u_range_cm_s": [round(lo * r0 / 1.5, 2), round(hi * r0 / 1.5, 2)],
                "p_window_kpa": iss["p_kpa"], "p_window_source": tsrc(hab["iss"]["target_sources"]["p"]),
                "p_tested_kpa": bass2["constants"]["pressure_kpa"], "y": p2["y_axis"], "minimum": p2["minimum"],
                "source": p2["source"], "check_a10": round(6 * exp(-0.5 * 10) + 0.0167 * 10 + 13.4, 4)}

    cl = []
    by_id = {t["id"]: t for t in bass2["tests"]}
    for c in clips["clips"]:
        t = by_id[c["test"]]
        steps = [s["cm_s"] for s in t["air_display"]["steps"] if s.get("cm_s") is not None]
        p2pt = c.get("panel2")
        flows = steps or ([p2pt["air_cm_s"]] if p2pt else [])
        cl.append({"test": c["test"], "title": c["title"], "clip": c["clip"], "poster": c["clip"].replace(".mp4", ".jpg"),
                   "o2_initial_pct": t["o2_initial_pct"], "p_kpa": t["pressure_kpa"], "flows": flows,
                   "flow_note": ("Air display steps" if steps else f"blowoff; flow at most {p2pt['air_cm_s']} cm/s (Panel 2 upper bound)" if p2pt else "no flow recorded"),
                   "flow_bound": "upper" if (not steps and p2pt) else None,
                   "geometry": t["geometry"]["label"], "rod_diameter_in": t["geometry"].get("rod_diameter_in"), "outcome": t["outcome"]["value"],
                   "src": f"{t['source']['file']}, line {t['source']['line']}"})

    if errors:
        raise SystemExit("05_build_sandbox: " + "; ".join(errors))
    write_json("sandbox.json", {
        "schema": 1,
        "note": "Flame Sandbox data. The flame picture is a teaching model and computes nothing; every number on the tab comes from here.",
        "quotes": {k: {"text": q, "source": "Space Apps 2026 challenge page", "file": "docs/ref/challenge_brief.md", "section": "1"} for k, q in QUOTES.items()},
        "video": {**VIDEO, "url": f"{m.group(1)}&t={VIDEO['start_s']}s", "summary": summ.group(1).strip(),
                  "summary_note": "Flame Frontier's summary of the official challenge video (auto-transcript errors corrected in brief sec. 4)"},
        "presets": presets,
        "zone": {"o2_min_pct": p1["moon_base_zone"]["o2_min_pct"], "p_max_kpa": p1["moon_base_zone"]["p_max_kpa"]},
        "habitats": [{"id": h["habitat"]["id"], "name": h["habitat"]["name"], "o2_pct": h["habitat"]["o2_pct"], "p_kpa": h["habitat"]["p_kpa"],
                      "gravity": h["habitat"]["gravity"], "window": h["window"], "solids_inside": h["tested"]["solids_inside"],
                      "flows_cm_s": h["tested"]["flows_cm_s"], "materials": h["tested"]["materials"], "gaps": [{"id": g["id"], "text": g["text"]} for g in h["gaps"]]}
                     for h in gaps["habitats"]],
        "tests": tests, "ssce": ssce, "boundary": boundary, "clips": cl, "rules": RULES,
        "units": {"psi_to_kpa": PSI_TO_KPA}, "x_max_kpa": p1["x_max"],
        "po2_sea_level": next({"kpa": l["pp_o2_kpa"], "label": l["label"]} for l in p1["pp_o2_lines"] if "sea-level" in l["label"]),
    })
    print(f"sandbox    {len(tests)} solid tests, {len(ssce)} SSCE ranges, {len(cl)} clips, {len(presets)} presets")


if __name__ == "__main__":
    main()
