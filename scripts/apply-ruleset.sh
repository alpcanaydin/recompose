#!/bin/sh
set -eu
repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
ruleset_id=$(gh api "repos/$repo/rulesets" --jq '[.[] | select(.name == "main")][0].id // empty')
if [ -n "$ruleset_id" ]; then
  gh api -X PUT "repos/$repo/rulesets/$ruleset_id" --input .github/rulesets/main.json
else
  gh api -X POST "repos/$repo/rulesets" --input .github/rulesets/main.json
fi
