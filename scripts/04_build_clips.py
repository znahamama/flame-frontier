"""Clips manifest -> data/processed/clips.json. Joins data/manual/clips.csv with bass2_tests.json and checks the
trimmed files exist and stay under the 5 MB git limit. Source MP4 checksums are recorded when the raw file is present."""
import csv
import hashlib
import json
import sys

from _common import PROCESSED, ROOT, write_json

LIMIT = 5 * 1024 * 1024


def main():
    tests = {t["id"]: t for t in json.loads((PROCESSED / "bass2_tests.json").read_text())["tests"]}
    p2 = {p["test"]: p for p in json.loads((PROCESSED / "bass2_tests.json").read_text())["panel2_points"]}
    prev = json.loads((PROCESSED / "clips.json").read_text()) if (PROCESSED / "clips.json").exists() else {}
    old_hero = prev.get("hero")
    old = {c["clip"]: c for c in json.loads((PROCESSED / "clips.json").read_text())["clips"]} if (PROCESSED / "clips.json").exists() else {}
    out, bad = [], []
    for r in csv.DictReader(open(ROOT / "data/manual/clips.csv", newline="")):
        f = ROOT / "web/public" / r["clip"]
        if not f.exists() or f.stat().st_size > LIMIT:
            bad.append(f"{r['clip']}: missing or over 5 MB")
            continue
        src = ROOT / r["source_file"]
        sha = hashlib.sha256(src.read_bytes()).hexdigest() if src.exists() else old.get(r["clip"], {}).get("source_sha256")
        t = tests[r["test"]]
        out.append({**r, "start_s": float(r["start_s"]), "duration_s": float(r["duration_s"]), "bytes": f.stat().st_size,
                    "source_sha256": sha, "source_name": src.name,
                    "test_info": {"pi": t["pi"], "date_actual": t["date_actual"], "geometry": t["geometry"]["label"],
                                  "rod_diameter_in": t["geometry"].get("rod_diameter_in"), "o2_initial_pct": t["o2_initial_pct"],
                                  "o2_final_pct": t["o2_final_pct"], "outcome": t["outcome"]["value"],
                                  "air_raw": t["air_display"]["raw"], "fan_raw": t["fan_display"]["raw"], "source": t["source"]},
                    "panel2": p2.get(r["test"])})
    hero = None
    for r in csv.DictReader(open(ROOT / "data/manual/hero_clip.csv", newline="")):
        f = ROOT / "web/public" / r["clip"]
        poster = f.with_suffix(".jpg")
        if not f.exists() or f.stat().st_size > LIMIT or not poster.exists():
            bad.append(f"{r['clip']}: missing, no poster, or over 5 MB")
            continue
        src = ROOT / r["source_file"]
        sha = hashlib.sha256(src.read_bytes()).hexdigest() if src.exists() else (old_hero or {}).get("source_sha256")
        t = tests[r["test"]]
        hero = {**r, "start_s": float(r["start_s"]), "duration_s": float(r["duration_s"]), "poster_s": float(r["poster_s"]),
                "poster": r["clip"].replace(".mp4", ".jpg"), "bytes": f.stat().st_size, "source_sha256": sha, "source_name": src.name,
                "test_info": {"pi": t["pi"], "date_actual": t["date_actual"], "geometry": t["geometry"]["label"],
                              "material_raw": t["geometry"]["material_raw"], "o2_initial_pct": t["o2_initial_pct"],
                              "pressure_kpa": t["pressure_kpa"], "pressure_basis": t["pressure_basis"], "source": t["source"]}}
    if bad:
        print("\n".join("FAIL " + b for b in bad)); sys.exit(1)
    write_json("clips.json", {"schema": 1, "clips": out, "hero": hero,
                              "provenance": "PSI-25 (BASS-II) raw video, CC0-1.0, DOI 10.60555/4qc4-de67; trimmed and re-encoded with macOS avconvert (scripts/make_clips.sh)."})


if __name__ == "__main__":
    main()
