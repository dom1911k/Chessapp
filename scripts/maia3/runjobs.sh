#!/usr/bin/env bash
# Runs calibration jobs in parallel. Each line of the jobs file: script<TAB>arg<TAB>arg...
# Usage: bash scripts/maia3/runjobs.sh jobs.txt [parallel=4]
set -u
cd "$(dirname "$0")/../.."
run() { IFS=$'\t' read -r -a a <<< "$1"; npx tsx "scripts/maia3/${a[0]}" "${a[@]:1}"; }
export -f run
tr '\n' '\0' < "$1" | xargs -0 -P "${2:-4}" -I{} bash -c 'run "$1"' _ {}
