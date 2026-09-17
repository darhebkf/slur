#!/usr/bin/env bash
set -euo pipefail

project_root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
claude_skill_dir="${HOME:?}/.claude/skills/slur"

cargo install --path "$project_root" --force

mkdir -p "$claude_skill_dir"
cp "$project_root/.claude/skills/slur/SKILL.md" "$claude_skill_dir/SKILL.md"

if command -v codex >/dev/null 2>&1; then
  codex plugin marketplace add "$project_root" >/dev/null 2>&1 || true
  codex plugin add slur@personal
fi

printf '%s\n' 'Installed Slur. Use /slur in Claude Code or select Slur from the Codex slash menu.'
