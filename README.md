# Slur

Slur is a local text generator for coding agents. It produces random combinations of one to five terms and can expand each standalone `/slur` token in a prompt.

Website: [ruls.dev](https://ruls.dev/)

```text
You /slur your work needs another pass, you /slur.
```

Slur preserves the surrounding text and expands each token independently. The submitted prompt remains visible in harnesses that support only model-context hooks. For details, see [Harness support](#harness-support).

## Install

On macOS or Linux, run:

```sh
curl -fsSL https://raw.githubusercontent.com/darhebkf/slur/main/scripts/install.sh | bash
```

On Windows, run in PowerShell:

```powershell
irm https://raw.githubusercontent.com/darhebkf/slur/main/scripts/install.ps1 | iex
```

The installer downloads the release for your operating system and architecture, verifies its SHA-256 checksum, and starts `slur setup`. The setup interface detects installed harnesses and selects them by default. Press Space to change the selection, and then press Enter to install the adapters.

To install adapters without the interactive interface, pass their names to the installer:

```sh
curl -fsSL https://raw.githubusercontent.com/darhebkf/slur/main/scripts/install.sh | bash -s -- claude codex
```

Supported names are `claude`, `codex`, `opencode`, `gemini`, `copilot`, `cursor`, `cline`, and `windsurf`. Pass `all` to install every adapter.

Set `SLUR_VERSION` to a release tag, such as `v0.9`, when you need to install a specific version instead of the latest release.

## Use the CLI

```sh
slur                         # Generate one combination.
slur 3                       # Generate three combinations.
slur expand "You /slur"      # Expand every standalone token.
slur setup                   # Detect harnesses and install adapters.
slur add "Custom phrase."    # Add a phrase to your local list.
slur block "word"            # Filter phrases that contain a value.
slur unblock "word"          # Remove a value from the filter list.
slur list                    # List active phrases.
slur off                     # Disable generated output.
slur on                      # Enable generated output.
slur status                  # Show the current configuration.
```

## Configure Slur

Slur stores its configuration in plain-text files:

- `~/.config/slur/phrases.txt` contains one custom phrase per line.
- `~/.config/slur/blocked.txt` contains one case-insensitive filter per line.
- `~/.config/slur/disabled` exists when generated output is disabled.
- `SLUR_HOME` overrides the configuration directory.

New configurations filter the racial and anti-gay slurs in the built-in source list. Run `slur unblock "word"` to remove a default filter.

Slur does not make network requests or collect telemetry while it generates text. The binary contains the built-in word list and harness adapters.

## Harness support

Harnesses expose different prompt-extension APIs. Slur uses the closest supported behavior:

| Harness | Behavior |
| --- | --- |
| Claude Code | Adds the expanded prompt to model context before inference. The submitted text remains visible. |
| Codex | Adds the expanded prompt to model context before inference. The submitted text remains visible. |
| OpenCode | Rewrites the prompt before submission. |
| Gemini CLI | Expands the command output before submission and might request command approval. |
| GitHub Copilot CLI | Replaces the model-facing prompt. The submitted text remains visible. |
| Cursor | Runs the generator through a command. |
| Cline | Runs the generator through a skill. |
| Windsurf | Runs the generator through a workflow. |

In Codex, you can also invoke the native skill as `$slur:slur`. Start a new task after you install an adapter so the harness can load it.

To test the Codex plugin from a cloned repository, run:

```sh
codex plugin marketplace add .
codex plugin add slur@slur-local
```

## Source data

The built-in list uses the English categories published by [CS2Tracker](https://cs2tracker.gg/slurs-tracking). The repository does not include player messages or identifying data. You can extend the list locally with `slur add`.

## Develop

Slur requires Rust 1.85 or later and uses the Rust 2024 edition. Run the Rust checks from the repository root:

```sh
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo build --release
```

To run the website locally, install [Bun](https://bun.sh/), and then run:

```sh
cd web
bun install --frozen-lockfile
bun run dev
```

Run `bun run build` to write the static site to `dist/` at the repository root.

## License

Slur is available under the [MIT License](LICENSE).
