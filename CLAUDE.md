# Flame Frontier: where NASA's fire evidence ends

NASA Space Apps Challenge 2026, "Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data". Solo build. All times America/St_Johns (NL). Tier 1 demo-able AND deployed: Sat 2026-11-14 21:00. Feature freeze Sun 12:00. Demo-ready Sun 16:00. Deadline Sun 2026-11-15 18:00.
Split: the user does browser-only work (PSI downloads, DevTools capture); Claude does everything else. Decide, then report. Stop only for costly-to-reverse choices or guesses about NASA data.

## Product
A dashboard that catalogs, ranks and interprets NASA microgravity combustion investigations (PSI), and shows where the fire-safety evidence ends compared with the air Moon-base and rover crews will breathe.
**Headline:** hundreds of space fire tests sit at Earth air. Moon-base air has a handful of points, at one flow speed, and none in partial gravity.
**RETIRED claim (false, never use):** "no solid-material test at Moon-base oxygen". Counter-evidence (user-supplied, confirm page/table against the PDFs when they arrive in docs/ref/):
- Saffire-VI: SIBAL cloth at 31.0% O2 / 54.1 kPa; two-sided PMMA at 30.3% / 54.6 kPa (ICES-2024-365, Table 1, p.3).
- SSCE: filter paper at 35% and 50% O2; PMMA at 50% and 70% O2; 1-2 atm (NTRS 20050177200).
- ACME CFI-G gas flames reached 85% O2.

## Tiers
- Tier 1 (tonight): Evidence Map panels 1+2, Catalog, Ranking (rule table), real BASS-II Clips, Known Limits. Deployed.
- Tier 2: cited Q&A (api/), build-time AI extraction.
- Tier 3 only: Three.js flame sandbox (a labelled teaching model, not a simulation).

## Evidence Map
**Panel 1 (headline):** x = total pressure (kPa), y = O2 %. Every test from every source. Reference marks (built by `scripts/04_build_reference.py`):
- spacesuit 100% O2 at 4.3 psi (29.6 kPa); Earth sea level 14.7 psi (101.3 kPa)
- Moon-base zone: >=30% O2 and <=10.2 psi (70.3 kPa), from the challenge brief
- lines of constant pO2: O2% = 100*pO2/P. 30% at 10.2 psi = 21.1 kPa pO2, about the same as sea-level air (21.2).
- Saffire-VI points sit at pO2 of about 16.5-16.8 kPa.
- Scatter palette: no more than 3 colored series (dataviz all-pairs rule). Beyond 3, encode the source with marker shape.

**Panel 2:** BASS-II published boundary, report sec. 6.1.4.4, printed p.75, eq. (6.1):
`X_O2 = 6 exp(-0.5a) + 0.0167a + 13.4`, with `a = (3/2)(U/r)(r/r0)^0.5`, r0 = 0.318 cm, U in cm/s, r in cm, a in 1/s.
- Plots Olson PMMA rod tests only. The curve is solid over the tested a-range (min/max a of the plotted rod points, set by the cleaning script into `reference.json: panel2.tested_a_range`) and dashed beyond it.
- The y-axis is POST-BURN (final) O2, as in report Fig. 6.9 ("Final O2 concentration (XO2)").
- Verified minimum: analytically a* = -2 ln(0.0167/3) = 10.38 1/s, giving X_O2 = 13.61%. The report text says "a = 8 to 12 s^-1 at approximately 13.5 percent O2". Show the computed 13.61% and quote the report's text separately.
- Fig. 6.9 also includes drop-tower data. We do not have that data, so say so.
- Every axis label names which O2 reading it shows: Panel 1 uses initial O2 and Panel 2 uses post-burn O2.

## Validity rules (non-negotiable)
- Every plotted point has a source shown as a tooltip: `{file, row}` for CSV data, or `{paper, table/section, page}`. `web/src/data.js: cite()` renders it. A point without a source is a bug.
- No AI-produced number ever appears on a chart.
- AI-extracted fields store `source_quote`, which must be an exact substring of the source text. If it is not, the value is null. Model output is validated with pydantic, retried once, then flagged. It is never silently accepted.
- Ranking uses a visible rule table with per-component contributions and template explanations, not AI prose.
- The Known Limits panel is always present.
- Public NASA/open data only. Never invent datasets, endpoints, formats or limits. If unsure, stop and say how to check.
- Make claims specific, e.g. "solid materials", "one flow speed".

## AI and budget
- About $5 of Anthropic credit. AI runs at build time only. Every response is cached in `data/llm_cache/` (keyed by input hash) and committed, so the demo works offline.
- Q&A: low max_tokens, plus an offline mode that serves cached answers. The key expires Nov 21, before judging. The Anthropic API is never called from the browser; only `api/` calls it, server-side.
- The key lives only in `.env` (gitignored; `.githooks/pre-commit` blocks env files, `sk-ant-` strings and files over 5 MB) and in Vercel env vars. Never print, log or echo it. To inspect `.env`, show variable names only.

## Hosting
Vercel free tier: static Vite build (`web/dist`) plus one Python function (`api/ask.py`). The root `requirements.txt` holds the function's runtime deps ONLY. Pipeline deps live in `scripts/requirements.txt`. `vercel.json` excludes web/, docs/, data/raw/ and scripts/ from the function bundle.

## Repo layout and commands
- `make setup` (one-time) | `make dev` (pipeline + http://localhost:5173) | `make build` | `make check` (secret guard status)
- `scripts/NN_*.py`: idempotent, numbered (01_fetch, 02_clean, 03_extract, 04_build), and run in order by `scripts/run_all.py`. They write through `_common.write_json`, which is deterministic and rewrites a file only when its content changes. Run them with `.venv/bin/python`.
- `data/raw/<PSI-ID>/`: files exactly as received, never edited, gitignored. PSI links are presigned and expire, so always save the files.
- `data/processed/`: the JSON the frontend reads (committed). Vite serves it at `/data/*` in dev and copies it to `dist/data` on build.
- `data/llm_cache/`: committed.
- `docs/ref/`: reference PDFs, gitignored. The BASS-II report is 49 MB; its SHA-256 is in docs/ref/README.md. Commit derived, page-cited outputs instead.
- `web/`: Vite + plain JS + Apache ECharts (tree-shaken). Tabs: Evidence Map, Catalog, Ranking, Clips, Known Limits. Colors are CSS tokens in style.css (light and dark).
- Media: raw MP4s never go in git. Web clips are trimmed and small (<5 MB each, enforced by the hook) and go in `web/public/clips/` via an explicit gitignore exception, added when the clips are made.

## Verified data facts
- PSI: psi.nasa.gov. Combustion science has 24 investigations, about 12 TB (official challenge video). Pages render with JS, so prefer the JSON endpoints found in DevTools > Network. Keep request volume low.
- Public S3 `s3://nasa-psi` holds only DSI, OASIS and pk4. It has no combustion data.
- BASS-II = PSI-25, CC0-1.0, DOI 10.60555/4qc4-de67. 130 ISS runs (2014, one in 2016). PIs: Bhattacharjee, Ferkul, Miller, Olson, Fernandez-Pello, T'ien.
  - Columns: PI, Test #, Date, GMT, Sample #, Fuel Sample Material, Flow restrictor, Fan display, Air display, Radiometer gain, Total Frames Shot, Calibrated initial/final O2 % by vol, Initial/Final CO2 %, Initial/Final CO (ppm).
  - **Air display** = airflow in cm/s, +/-0.5 cm/s. It comes from the TSI 8475 air-velocity transducer between the honeycomb and the screen. The display reads whole units only, and the probe responds in about 1 min (report sec. 6.1.3, printed p.66).
  - **Fan display** = fan voltage / potentiometer setting. It is a control input, not a flow speed. Report p.66: "The voltage to the fan was displayed and could be set." Appendix table footnote: "Potentiometer (pot)" (PDF p.111). The fan is calibrated to flow daily, per restrictor.
  - Both columns hold sequences of crew-noted steps and outcomes ("5 3 2 ext", "no ign at any flow"). Parse them into steps and keep the raw text.
  - Max flow is about 55 cm/s with no restrictor and about 35 cm/s with 2 restrictors (p.66). The CSTR N2 dilution reached initial O2 as low as 13.6% (p.67). All tests ran at 1 atm.
  - Panel 1 uses INITIAL O2; Panel 2 uses post-burn O2 for the rod tests. Some final O2 values are sensor errors (0.6, 0.9, 1.6, 39.1, 40.4), so flag them and do not plot them. Values "none", "OR", "over" and "video" occur. The date "6/24/2018" for T9/T18 is likely a typo for 2014: flag it, do not fix it.
  - Rod radii: 0.318 cm (primary), 0.476 and 0.635 cm. Clear and black PMMA showed no flammability difference (p.67).
- BASS-II Summary Report: NASA/TM-20210011385, Oct 2021, 144 pp. PDF page = printed page + 8. Sec. 1.6 covers conclusions (fuel-rich flames, global equivalence ratio about 1.3, most tests under 100 W).
- BASS-II raw data has one MP4 per test (e.g. `PSI-25_Raw Data_BASS_GMT50_SAMPLE_147_TEST_B1.mp4`). The investigation totals 255 GB, so download single clips only.
- Challenge brief: spacesuit 100% O2 at 4.3 psi; Earth 14.7 psi; Moon base and rovers at 30%+ O2 and <=10.2 psi; no partial-gravity combustion data in PSI (future: LUCI, FM2); ACME E-FIELD mimicked partial gravity with electric fields; micro- and normal-gravity results can bound intermediate gravity.
- Microgravity flames look spherical, blue and soot-free, and do not flicker. Earth flames are teardrop-shaped, yellow from soot carried upward, and flicker.

## Judging (1-5 each)
Impact, Creativity, Validity, Relevance (NASA data must be core), Presentation. Submission: max 7 slides or a 30 s video, English. References must list ALL external resources (NASA data, ECharts, Vite, Anthropic API, images).
