# Slur

Slur is a tiny local phrase cannon for the moment an AI agent confidently does the wrong thing. The engine is a dependency-free Rust 2024 binary; the repository also includes a portable Codex/Claude Code skill and a Bun + Vite site.

The shipped pack is aimed at machines and software behavior. Add any personal vocabulary locally, blacklist individual words or phrases, or disable output entirely.

## One-shot install

```sh
./scripts/install.sh
```

The installer builds the release binary, installs the Claude Code skill for `/slur`, and registers the local Codex plugin marketplace when those harnesses are available.

## CLI

```sh
slur                         # one phrase
slur 3                       # three unique phrases
slur add "Custom phrase."    # append to the local pack
slur block "word"            # hide every phrase containing word
slur unblock "word"
slur list
slur off
slur on
slur status
```

Configuration is deliberately boring and portable:

- `~/.config/slur/phrases.txt` — one custom phrase per line
- `~/.config/slur/blocked.txt` — one case-insensitive filter per line
- `~/.config/slur/disabled` — marker file created by `slur off`
- `SLUR_HOME` — optional configuration-directory override

There is no network call, telemetry, service, or runtime database. The built-in phrase table is compiled into the binary; the user database is plain text so it is easy to inspect and edit.

## Harnesses

### Claude Code

The repository-scoped skill at `.claude/skills/slur/SKILL.md` makes `/slur` available when Claude Code starts in this project. To load the distributable plugin directly:

```sh
claude --plugin-dir ./plugins/slur
```

### Codex

Codex discovers the repository skill in `.agents/skills/slur`. It appears in the slash menu and can also be invoked explicitly as `$slur`.

To test the packaged plugin through its repository marketplace:

```sh
codex plugin marketplace add .
codex plugin add slur@personal
```

Start a new task after installing so the new skill is loaded.

## Website

```sh
cd web
bun install
bun run dev
```

The site is a Vite SPA built with React, Motion, Tailwind CSS, and shadcn components. `bun run build` writes the static deployment to `dist/` at the repository root.

## Development

```sh
cargo fmt --check
cargo test
cargo build --release
cd web && bun run build
```

The release binary has no third-party Rust dependencies and is built with LTO, one codegen unit, symbol stripping, and abort-on-panic.
