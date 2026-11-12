# Integrations

These examples start the local SkillGuard MCP server. They do not upload skill contents.

Install the CLI first:

```bash
npm install -g .
skillguard --version
```

## Claude Code

Copy [examples/integrations/claude.mcp.json](../examples/integrations/claude.mcp.json) into the project's `.mcp.json`, or merge the `skillguard` server into the existing file.

## Cursor

Copy [examples/integrations/cursor.mcp.json](../examples/integrations/cursor.mcp.json) to `.cursor/mcp.json`.

## Codex

Copy [examples/integrations/codex.mcp.json](../examples/integrations/codex.mcp.json) into the Codex MCP configuration.

## Pre-commit

Use this in a repository that **contains skills**. Do not install it inside the SkillGuard repository: the intentional risky fixtures would fail the hook.

```bash
cp scripts/pre-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

If `skillguard` is not on `PATH`:

```bash
export SKILLGUARD_BIN=/absolute/path/to/SkillGuard/src/cli.js
```

## Markdown review

```bash
skillguard ./my-skill --format markdown --output review.md
```

## GitHub Action

See [github-action.md](github-action.md). Prefer a release tag or full commit SHA over `@main` in production.
