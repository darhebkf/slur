use std::env;
use std::fs;
use std::io::{self, IsTerminal};
use std::path::{Path, PathBuf};
use std::process::Command;

use clap::ValueEnum;

const CLAUDE_MARKETPLACE: &str = include_str!("../.claude-plugin/marketplace.json");
const CLAUDE_MANIFEST: &str = include_str!("../plugins/slur/.claude-plugin/plugin.json");
const OPENCODE_COMMAND: &str = include_str!("../.opencode/commands/slur.md");
const OPENCODE_PLUGIN: &str = include_str!("../.opencode/plugin/slur.js");
const GEMINI_COMMAND: &str = include_str!("../.gemini/commands/slur.toml");
const COPILOT_SKILL: &str = include_str!("../.github/skills/slur/SKILL.md");
const COPILOT_HOOK: &str = include_str!("../.github/hooks/slur.json");
const CURSOR_MANIFEST: &str = include_str!("../plugins/slur/.cursor-plugin/plugin.json");
const CURSOR_COMMAND: &str = include_str!("../.cursor/commands/slur.md");
const CLINE_SKILL: &str = include_str!("../.cline/skills/slur/SKILL.md");
const WINDSURF_WORKFLOW: &str = include_str!("../.windsurf/workflows/slur.md");
const CODEX_MARKETPLACE: &str = include_str!("../.agents/plugins/marketplace.json");
const CODEX_MANIFEST: &str = include_str!("../plugins/slur/.codex-plugin/plugin.json");
const SLUR_SKILL: &str = include_str!("../plugins/slur/skills/slur/SKILL.md");
const SLUR_SKILL_INTERFACE: &str = include_str!("../plugins/slur/skills/slur/agents/openai.yaml");
const PROMPT_HOOKS: &str = include_str!("../plugins/slur/hooks/hooks.json");

/// A coding-agent harness that can receive a Slur adapter.
#[derive(Clone, Copy, Debug, Eq, PartialEq, ValueEnum)]
pub enum Harness {
    /// Claude Code.
    Claude,
    /// Codex.
    Codex,
    /// OpenCode.
    Opencode,
    /// Gemini CLI.
    Gemini,
    /// GitHub Copilot CLI.
    Copilot,
    /// Cursor.
    Cursor,
    /// Cline.
    Cline,
    /// Windsurf.
    Windsurf,
}

impl Harness {
    /// Every supported harness in setup display order.
    pub const ALL: [Self; 8] = [
        Self::Claude,
        Self::Codex,
        Self::Opencode,
        Self::Gemini,
        Self::Copilot,
        Self::Cursor,
        Self::Cline,
        Self::Windsurf,
    ];

    fn label(self) -> &'static str {
        match self {
            Self::Claude => "Claude Code",
            Self::Codex => "Codex",
            Self::Opencode => "OpenCode",
            Self::Gemini => "Gemini CLI",
            Self::Copilot => "GitHub Copilot CLI",
            Self::Cursor => "Cursor",
            Self::Cline => "Cline",
            Self::Windsurf => "Windsurf",
        }
    }
}

struct Layout {
    home: PathBuf,
    config: PathBuf,
    data: PathBuf,
}

impl Layout {
    fn discover() -> Result<Self, String> {
        let home = env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
            .map(PathBuf::from)
            .ok_or_else(|| "cannot find the user home directory".to_owned())?;
        let config = env::var_os(if cfg!(windows) {
            "APPDATA"
        } else {
            "XDG_CONFIG_HOME"
        })
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join(".config"));
        let data = env::var_os(if cfg!(windows) {
            "LOCALAPPDATA"
        } else {
            "XDG_DATA_HOME"
        })
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join(".local/share"));

        Ok(Self { home, config, data })
    }

    #[cfg(test)]
    fn rooted(root: PathBuf) -> Self {
        Self {
            home: root.clone(),
            config: root.join(".config"),
            data: root.join(".local/share"),
        }
    }
}

/// Installs adapters for the requested or detected harnesses.
pub fn run(requested: Vec<Harness>, all: bool, yes: bool) -> Result<(), String> {
    let layout = Layout::discover()?;
    let detected = detect(&layout);
    let interactive = io::stdin().is_terminal() && io::stderr().is_terminal() && !yes;

    let selected = if all {
        Harness::ALL.to_vec()
    } else if !requested.is_empty() {
        deduplicate(requested)
    } else if interactive {
        prompt_for_harnesses(&detected).map_err(|error| error.to_string())?
    } else {
        detected
    };

    if selected.is_empty() {
        if interactive {
            cliclack::outro("binary installed; no harness adapters selected")
                .map_err(|error| error.to_string())?;
        } else {
            println!("binary installed; no harnesses detected — run `slur setup`");
        }
        return Ok(());
    }

    for harness in &selected {
        install(*harness, &layout, true)?;
    }

    let names = selected
        .iter()
        .map(|harness| harness.label())
        .collect::<Vec<_>>()
        .join(", ");
    if interactive {
        cliclack::outro(format!(
            "installed for {names} — restart, then use /slur anywhere"
        ))
        .map_err(|error| error.to_string())?;
    } else {
        println!("installed for {names}; restart, then use /slur anywhere");
    }
    Ok(())
}

fn prompt_for_harnesses(detected: &[Harness]) -> io::Result<Vec<Harness>> {
    cliclack::intro(" slur ")?;
    let mut prompt = cliclack::multiselect("Select harnesses")
        .required(false)
        .initial_values(detected.to_vec());

    for harness in Harness::ALL {
        let hint = if detected.contains(&harness) {
            "detected"
        } else {
            ""
        };
        prompt = prompt.item(harness, harness.label(), hint);
    }

    prompt.interact()
}

fn deduplicate(values: Vec<Harness>) -> Vec<Harness> {
    Harness::ALL
        .into_iter()
        .filter(|candidate| values.contains(candidate))
        .collect()
}

fn detect(layout: &Layout) -> Vec<Harness> {
    Harness::ALL
        .into_iter()
        .filter(|harness| is_detected(*harness, layout))
        .collect()
}

fn is_detected(harness: Harness, layout: &Layout) -> bool {
    match harness {
        Harness::Claude => command_exists("claude") || layout.home.join(".claude").exists(),
        Harness::Codex => command_exists("codex") || layout.home.join(".codex").exists(),
        Harness::Opencode => command_exists("opencode") || layout.config.join("opencode").exists(),
        Harness::Gemini => command_exists("gemini") || layout.home.join(".gemini").exists(),
        Harness::Copilot => command_exists("copilot") || layout.home.join(".copilot").exists(),
        Harness::Cursor => {
            command_exists("cursor")
                || layout.home.join(".cursor").exists()
                || application_exists("Cursor")
        }
        Harness::Cline => {
            layout.home.join(".cline").exists()
                || vscode_extension_exists(&layout.home, "claude-dev")
        }
        Harness::Windsurf => {
            command_exists("windsurf")
                || layout.home.join(".codeium/windsurf").exists()
                || application_exists("Windsurf")
        }
    }
}

fn command_exists(command: &str) -> bool {
    let Some(path) = env::var_os("PATH") else {
        return false;
    };

    env::split_paths(&path).any(|directory| {
        if directory.join(command).is_file() {
            return true;
        }
        cfg!(windows)
            && ["exe", "cmd", "bat"]
                .iter()
                .any(|extension| directory.join(format!("{command}.{extension}")).is_file())
    })
}

fn application_exists(name: &str) -> bool {
    if !cfg!(target_os = "macos") {
        return false;
    }
    let filename = format!("{name}.app");
    Path::new("/Applications").join(&filename).exists()
        || env::var_os("HOME")
            .map(PathBuf::from)
            .is_some_and(|home| home.join("Applications").join(filename).exists())
}

fn vscode_extension_exists(home: &Path, needle: &str) -> bool {
    [".vscode/extensions", ".vscode-insiders/extensions"]
        .iter()
        .filter_map(|directory| fs::read_dir(home.join(directory)).ok())
        .flatten()
        .filter_map(Result::ok)
        .any(|entry| entry.file_name().to_string_lossy().contains(needle))
}

fn install(harness: Harness, layout: &Layout, run_external: bool) -> Result<(), String> {
    match harness {
        Harness::Claude => install_claude(layout, run_external)?,
        Harness::Codex => install_codex(layout, run_external)?,
        Harness::Opencode => {
            write(
                &layout.config.join("opencode/commands/slur.md"),
                OPENCODE_COMMAND,
            )?;
            write(
                &layout.config.join("opencode/plugin/slur.js"),
                OPENCODE_PLUGIN,
            )?;
        }
        Harness::Gemini => write(
            &layout.home.join(".gemini/commands/slur.toml"),
            GEMINI_COMMAND,
        )?,
        Harness::Copilot => {
            write(
                &layout.home.join(".copilot/skills/slur/SKILL.md"),
                COPILOT_SKILL,
            )?;
            write(&layout.home.join(".copilot/hooks/slur.json"), COPILOT_HOOK)?;
        }
        Harness::Cursor => {
            let root = layout.home.join(".cursor/plugins/local/slur");
            write(&root.join(".cursor-plugin/plugin.json"), CURSOR_MANIFEST)?;
            write(&root.join("commands/slur.md"), CURSOR_COMMAND)?;
        }
        Harness::Cline => write(
            &layout.home.join(".cline/skills/slur/SKILL.md"),
            CLINE_SKILL,
        )?,
        Harness::Windsurf => write(
            &layout
                .home
                .join(".codeium/windsurf/global_workflows/slur.md"),
            WINDSURF_WORKFLOW,
        )?,
    }
    Ok(())
}

fn install_claude(layout: &Layout, run_external: bool) -> Result<(), String> {
    let marketplace = layout.data.join("slur/claude-marketplace");
    write(
        &marketplace.join(".claude-plugin/marketplace.json"),
        CLAUDE_MARKETPLACE,
    )?;
    let plugin = marketplace.join("plugins/slur");
    write(&plugin.join(".claude-plugin/plugin.json"), CLAUDE_MANIFEST)?;
    write(&plugin.join("skills/slur/SKILL.md"), SLUR_SKILL)?;
    write(
        &plugin.join("skills/slur/agents/openai.yaml"),
        SLUR_SKILL_INTERFACE,
    )?;
    write(&plugin.join("hooks/hooks.json"), PROMPT_HOOKS)?;
    remove_directory(&plugin.join("commands"))?;

    let legacy_skill = layout.home.join(".claude/skills/slur");
    if legacy_skill.exists() {
        fs::remove_dir_all(&legacy_skill)
            .map_err(|error| format!("cannot remove {}: {error}", legacy_skill.display()))?;
    }

    if !run_external {
        return Ok(());
    }
    if !command_exists("claude") {
        return Err("Claude Code was selected but the `claude` command is unavailable".to_owned());
    }

    let _ = Command::new("claude")
        .args(["plugin", "marketplace", "add", "--scope", "user"])
        .arg(&marketplace)
        .status();
    let status = Command::new("claude")
        .args([
            "plugin",
            "install",
            "slur@slur-local",
            "--scope",
            "user",
            "--yes",
        ])
        .status()
        .map_err(|error| format!("failed to run Claude plugin installer: {error}"))?;
    if !status.success() {
        return Err("Claude plugin installation failed".to_owned());
    }
    let _ = Command::new("claude")
        .args(["plugin", "update", "slur@slur-local"])
        .status();
    Ok(())
}

fn install_codex(layout: &Layout, run_external: bool) -> Result<(), String> {
    let marketplace = layout.data.join("slur/codex-marketplace");
    write(
        &marketplace.join(".agents/plugins/marketplace.json"),
        CODEX_MARKETPLACE,
    )?;
    let plugin = marketplace.join("plugins/slur");
    write(&plugin.join(".codex-plugin/plugin.json"), CODEX_MANIFEST)?;
    write(&plugin.join("hooks/hooks.json"), PROMPT_HOOKS)?;
    write(&plugin.join("skills/slur/SKILL.md"), SLUR_SKILL)?;
    write(
        &plugin.join("skills/slur/agents/openai.yaml"),
        SLUR_SKILL_INTERFACE,
    )?;
    remove_directory(&plugin.join("commands"))?;

    if !run_external {
        return Ok(());
    }
    if !command_exists("codex") {
        return Err("Codex was selected but the `codex` command is unavailable".to_owned());
    }

    let _ = Command::new("codex")
        .args(["plugin", "marketplace", "add"])
        .arg(&marketplace)
        .status();
    let status = Command::new("codex")
        .args(["plugin", "add", "slur@slur-local"])
        .status()
        .map_err(|error| format!("failed to run Codex plugin installer: {error}"))?;
    if !status.success() {
        return Err("Codex plugin installation failed".to_owned());
    }
    Ok(())
}

fn write(path: &Path, contents: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
    }
    fs::write(path, contents).map_err(|error| format!("cannot write {}: {error}", path.display()))
}

fn remove_directory(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_dir_all(path)
            .map_err(|error| format!("cannot remove {}: {error}", path.display()))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temporary_root(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be valid")
            .as_nanos();
        env::temp_dir().join(format!("slur-{label}-{nonce}"))
    }

    #[test]
    fn installs_every_embedded_adapter() {
        let root = temporary_root("setup");
        let layout = Layout::rooted(root.clone());

        for harness in Harness::ALL {
            install(harness, &layout, false).expect("adapter should install");
        }

        assert!(
            root.join(".local/share/slur/claude-marketplace/plugins/slur/hooks/hooks.json")
                .is_file()
        );
        assert!(
            root.join(".local/share/slur/claude-marketplace/plugins/slur/skills/slur/SKILL.md")
                .is_file()
        );
        assert!(root.join(".config/opencode/commands/slur.md").is_file());
        assert!(root.join(".config/opencode/plugin/slur.js").is_file());
        assert!(root.join(".gemini/commands/slur.toml").is_file());
        assert!(root.join(".copilot/hooks/slur.json").is_file());
        assert!(
            root.join(".cursor/plugins/local/slur/commands/slur.md")
                .is_file()
        );
        assert!(root.join(".cline/skills/slur/SKILL.md").is_file());
        assert!(
            root.join(".codeium/windsurf/global_workflows/slur.md")
                .is_file()
        );
        assert!(
            root.join(".local/share/slur/codex-marketplace/plugins/slur/.codex-plugin/plugin.json")
                .is_file()
        );
        assert!(
            root.join(".local/share/slur/codex-marketplace/plugins/slur/skills/slur/SKILL.md")
                .is_file()
        );
        assert!(
            root.join(".local/share/slur/codex-marketplace/plugins/slur/hooks/hooks.json")
                .is_file()
        );
        assert!(
            !root
                .join(".local/share/slur/codex-marketplace/plugins/slur/commands")
                .exists()
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn deduplicates_targets_in_display_order() {
        assert_eq!(
            deduplicate(vec![Harness::Cursor, Harness::Claude, Harness::Cursor]),
            vec![Harness::Claude, Harness::Cursor]
        );
    }
}
