#!/bin/sh
# Install this hook in a repository that CONTAINS skills, not inside SkillGuard itself.
# SkillGuard's own examples include intentional malicious fixtures and would fail the gate.
#
#   cp scripts/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
#
# Requires `skillguard` on PATH, or set SKILLGUARD_BIN to src/cli.js via node.
set -eu

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "SkillGuard pre-commit: not a git work tree, skipping."
  exit 0
fi

files=$(git diff --cached --name-only --diff-filter=ACMR)
if [ -z "$files" ]; then
  exit 0
fi

selected=""
for file in $files; do
  case "$file" in
    *.md|*.txt|*.json|*.yml|*.yaml|*.js|*.mjs|*.cjs|*.ts|*.tsx|*.py|*.sh|*.ps1|SKILL.md)
      selected="$selected $file"
      ;;
  esac
done

if [ -z "$selected" ]; then
  exit 0
fi

if [ -n "${SKILLGUARD_BIN:-}" ]; then
  # shellcheck disable=SC2086
  node "$SKILLGUARD_BIN" $selected --fail-on high --format text
else
  # shellcheck disable=SC2086
  skillguard $selected --fail-on high --format text
fi
