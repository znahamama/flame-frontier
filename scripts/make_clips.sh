#!/bin/bash
# Re-creates web/public/clips/*.mp4 from the raw PSI-25 videos listed in data/manual/clips.csv.
# Not part of the pipeline: raw MP4s are gitignored and never deployed. Needs macOS avconvert.
set -euo pipefail
cd "$(dirname "$0")/.."
tail -n +2 data/manual/clips.csv | while IFS=, read -r clip test src start dur preset _rest; do
  avconvert -s "$src" -p "$preset" -o "web/public/$clip" --start "$start" --duration "$dur" --replace
done
