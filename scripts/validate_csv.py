#!/usr/bin/env python3
import sys, csv, os, argparse

SCHEMAS = {
  "games.csv": ["date","team","opponent","team_ml","opp_ml","win","b2b","road_to_road"],
  "lineups.csv": ["date","team","player","played"],
  "today_schedule.csv": ["date","team","opponent","base_p_team","base_p_opp","b2b_team_pp","r2r_team_pp","b2b_opp_pp","r2r_opp_pp","l5_adj_team_pp","l5_adj_opp_pp","w7_team_games","w7_opp_games"],
  "today_lineups.csv": ["date","team","player","expected_play"],
  "prohibidos.csv": ["player","team","reason","until_date"],
  # Optional
  "props_candidates.csv": ["team","player","points_line","pp_unit","line"],
  "nhl_changelog.csv": None  # any columns allowed
}

def read_header(path):
  with open(path, newline="", encoding="utf-8") as f:
    r = csv.reader(f)
    for row in r:
      # return first non-empty row as header
      if any(c.strip() for c in row):
        return [c.strip() for c in row]
  return []

def main():
  ap = argparse.ArgumentParser()
  ap.add_argument("--strict", action="store_true", help="fail if required CSVs missing")
  args = ap.parse_args()
  base = os.path.join(os.getcwd(), "data")
  if not os.path.isdir(base):
    print("::warning::No data/ folder found; skipping.")
    return 0
  failures = 0
  for name, header in SCHEMAS.items():
    path = os.path.join(base, name)
    if not os.path.exists(path):
      if args.strict and name in ["games.csv","lineups.csv","today_schedule.csv","today_lineups.csv"]:
        print(f"::error::{name} is missing in data/")
        failures += 1
      else:
        print(f"::notice::{name} not found (ok).")
      continue
    actual = read_header(path)
    if not actual:
      print(f"::error::{name} is empty or has no header")
      failures += 1
      continue
    if header is None:
      print(f"::notice::{name} found (free schema).")
      continue
    missing = [c for c in header if c not in actual]
    if missing:
      print(f"::error::{name} missing columns: {missing}; has: {actual}")
      failures += 1
    else:
      print(f"::notice::{name} ✓ header OK")
  return 1 if failures else 0

if __name__ == "__main__":
  sys.exit(main())
