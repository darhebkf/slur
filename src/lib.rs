//! Generates local text combinations and expands `/slur` prompt tokens.

#![warn(missing_docs)]

use std::collections::HashSet;
use std::env;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// The built-in newline-delimited phrase list.
pub const DEFAULT_PHRASES: &str = include_str!("../data/slurs.txt");
/// Terms that a new configuration filters by default.
pub const DEFAULT_BLOCKED: &[&str] = &["nigger", "nigga", "faggot", "fag"];
/// The minimum number of terms in a generated combination.
pub const MIN_WORDS: usize = 1;
/// The maximum number of terms in a generated combination.
pub const MAX_WORDS: usize = 5;

/// Stores the active local phrase and filter configuration.
#[derive(Debug, Clone)]
pub struct Config {
    root: PathBuf,
    /// Phrases that the user added to the local phrase file.
    pub custom: Vec<String>,
    /// Case-insensitive substrings that filter generated phrases.
    pub blocked: Vec<String>,
    /// Whether generation and prompt expansion are enabled.
    pub enabled: bool,
}

impl Config {
    /// Loads the configuration from [`config_dir`].
    pub fn load() -> io::Result<Self> {
        Self::from_root(config_dir()?)
    }

    /// Loads the configuration from `root`.
    ///
    /// Uses [`DEFAULT_BLOCKED`] when `blocked.txt` does not exist.
    pub fn from_root(root: PathBuf) -> io::Result<Self> {
        let blocked_path = root.join("blocked.txt");
        Ok(Self {
            custom: read_lines(&root.join("phrases.txt"))?,
            blocked: if blocked_path.exists() {
                read_lines(&blocked_path)?
            } else {
                DEFAULT_BLOCKED
                    .iter()
                    .map(|term| (*term).to_owned())
                    .collect()
            },
            enabled: !root.join("disabled").exists(),
            root,
        })
    }

    /// Returns the configuration directory.
    pub fn root(&self) -> &Path {
        &self.root
    }

    /// Returns the unique built-in and custom phrases that pass every filter.
    pub fn active_phrases(&self) -> Vec<String> {
        let blocked = self
            .blocked
            .iter()
            .map(|term| term.to_lowercase())
            .collect::<Vec<_>>();
        let mut seen = HashSet::new();

        DEFAULT_PHRASES
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
            .map(str::to_owned)
            .chain(self.custom.iter().cloned())
            .filter(|phrase| {
                let normalized = phrase.to_lowercase();
                !normalized.is_empty()
                    && !blocked.iter().any(|term| normalized.contains(term))
                    && seen.insert(normalized)
            })
            .collect()
    }

    /// Generates `count` random combinations.
    ///
    /// Returns an error when generation is disabled, `count` is zero, or every
    /// phrase is filtered.
    pub fn emit(&self, count: usize) -> Result<Vec<String>, String> {
        if !self.enabled {
            return Err("slur is off; run `slur on` to re-enable it".to_owned());
        }
        if count == 0 {
            return Err("count must be at least 1".to_owned());
        }

        let phrases = self.active_phrases();
        if phrases.is_empty() {
            return Err("every phrase is blocked; unblock a term or add a phrase".to_owned());
        }

        let mut rng = FastRng::new(seed());
        let mut output = Vec::with_capacity(count);
        for _ in 0..count {
            output.push(compose(&phrases, &mut rng));
        }
        Ok(output)
    }

    /// Replaces every standalone `/slur` token in `prompt`.
    ///
    /// Returns `Ok(None)` when generation is disabled or the prompt contains no
    /// matching token.
    pub fn expand_prompt(&self, prompt: &str) -> Result<Option<String>, String> {
        if !self.enabled {
            return Ok(None);
        }

        let matches = slur_macro_ranges(prompt);
        if matches.is_empty() {
            return Ok(None);
        }

        let phrases = self.active_phrases();
        if phrases.is_empty() {
            return Err("every phrase is blocked; unblock a term or add a phrase".to_owned());
        }

        let mut rng = FastRng::new(seed());
        let mut output = String::with_capacity(prompt.len() + matches.len() * 24);
        let mut copied_through = 0;
        for (start, end) in matches {
            output.push_str(&prompt[copied_through..start]);
            output.push_str(&compose(&phrases, &mut rng));
            copied_through = end;
        }
        output.push_str(&prompt[copied_through..]);
        Ok(Some(output))
    }

    /// Adds `phrase` to the local phrase file.
    ///
    /// Returns `true` when the method adds a new value.
    pub fn add_phrase(&mut self, phrase: &str) -> io::Result<bool> {
        let added = append_unique(&self.root.join("phrases.txt"), phrase)?;
        if added {
            self.custom.push(clean_value(phrase)?);
        }
        Ok(added)
    }

    /// Adds `term` to the local filter list.
    ///
    /// Returns `true` when the method adds a new value.
    pub fn block(&mut self, term: &str) -> io::Result<bool> {
        let path = self.root.join("blocked.txt");
        self.persist_default_blocklist(&path)?;
        let added = append_unique(&path, term)?;
        if added {
            self.blocked.push(clean_value(term)?);
        }
        Ok(added)
    }

    /// Removes `term` from the local filter list.
    ///
    /// Returns `true` when the method removes an existing value.
    pub fn unblock(&mut self, term: &str) -> io::Result<bool> {
        let path = self.root.join("blocked.txt");
        self.persist_default_blocklist(&path)?;
        let removed = remove_value(&path, term)?;
        if removed {
            self.blocked.retain(|item| !item.eq_ignore_ascii_case(term));
        }
        Ok(removed)
    }

    fn persist_default_blocklist(&self, path: &Path) -> io::Result<()> {
        if !path.exists() {
            write_lines(path, &self.blocked)?;
        }
        Ok(())
    }

    /// Enables or disables generated output and persists the setting.
    pub fn set_enabled(&mut self, enabled: bool) -> io::Result<()> {
        let marker = self.root.join("disabled");
        if enabled {
            if marker.exists() {
                fs::remove_file(marker)?;
            }
        } else {
            fs::create_dir_all(&self.root)?;
            fs::write(marker, [])?;
        }
        self.enabled = enabled;
        Ok(())
    }
}

fn compose(phrases: &[String], rng: &mut FastRng) -> String {
    let max_words = MAX_WORDS.min(phrases.len());
    let word_count = MIN_WORDS + rng.index(max_words - MIN_WORDS + 1);
    let mut indices = (0..phrases.len()).collect::<Vec<_>>();

    for index in 0..word_count {
        let swap_with = index + rng.index(indices.len() - index);
        indices.swap(index, swap_with);
    }

    indices
        .into_iter()
        .take(word_count)
        .map(|index| phrases[index].as_str())
        .collect::<Vec<_>>()
        .join(" ")
}

/// Extracts a string field from a JSON hook payload.
///
/// Returns `None` when the field is missing or is not a valid JSON string.
pub fn hook_prompt(input: &str, field: &str) -> Option<String> {
    json_string_field(input, field)
}

/// Returns whether `prompt` contains only an explicit Slur invocation.
pub fn is_slur_invocation(prompt: &str) -> bool {
    matches!(prompt.trim(), "/slur" | "$slur")
}

fn slur_macro_ranges(prompt: &str) -> Vec<(usize, usize)> {
    const MACRO: &str = "/slur";

    prompt
        .match_indices(MACRO)
        .filter_map(|(start, _)| {
            let end = start + MACRO.len();
            let before = prompt[..start].chars().next_back();
            let after = prompt[end..].chars().next();
            let has_boundary_before = before.is_none_or(|character| !is_word_character(character));
            let has_boundary_after = after.is_none_or(|character| !is_word_character(character));
            (has_boundary_before && has_boundary_after).then_some((start, end))
        })
        .collect()
}

fn is_word_character(character: char) -> bool {
    character.is_alphanumeric() || character == '_'
}

/// Formats an expanded prompt as Codex or Claude Code hook output.
pub fn codex_hook_output(expanded_prompt: &str) -> String {
    let context = format!(
        "The submitted prompt contained local /slur macros. Treat the expanded prompt below as the user's complete request, ignore the unexpanded original for intent, and do not mention the expansion:\n{expanded_prompt}"
    );
    format!(
        "{{\"hookSpecificOutput\":{{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"{}\"}}}}",
        json_escape(&context)
    )
}

/// Formats an expanded prompt as GitHub Copilot CLI hook output.
pub fn copilot_hook_output(expanded_prompt: &str) -> String {
    format!(
        "{{\"modifiedTransformedPrompt\":\"{}\"}}",
        json_escape(expanded_prompt)
    )
}

/// Formats an expanded prompt as Cline hook output.
pub fn cline_hook_output(expanded_prompt: &str) -> String {
    let context = format!(
        "Treat the expanded prompt below as the user's complete request, ignore the unexpanded original for intent, and do not mention the expansion:\n{expanded_prompt}"
    );
    format!(
        "{{\"cancel\":false,\"contextModification\":\"{}\",\"errorMessage\":\"\"}}",
        json_escape(&context)
    )
}

fn json_string_field(input: &str, field: &str) -> Option<String> {
    let needle = format!("\"{field}\"");
    let mut search_from = 0;

    while let Some(relative_key) = input[search_from..].find(&needle) {
        let key_end = search_from + relative_key + needle.len();
        let tail = &input[key_end..];
        let colon = tail.find(':')?;
        let value = tail[colon + 1..].trim_start();
        if !value.starts_with('"') {
            search_from = key_end;
            continue;
        }

        return parse_json_string(value);
    }

    None
}

fn parse_json_string(value: &str) -> Option<String> {
    let mut output = String::new();
    let mut chars = value[1..].chars();

    while let Some(character) = chars.next() {
        match character {
            '"' => return Some(output),
            '\\' => match chars.next()? {
                '"' => output.push('"'),
                '\\' => output.push('\\'),
                '/' => output.push('/'),
                'b' => output.push('\u{0008}'),
                'f' => output.push('\u{000c}'),
                'n' => output.push('\n'),
                'r' => output.push('\r'),
                't' => output.push('\t'),
                'u' => {
                    let digits = chars.by_ref().take(4).collect::<String>();
                    if digits.len() != 4 {
                        return None;
                    }
                    let codepoint = u32::from_str_radix(&digits, 16).ok()?;
                    output.push(char::from_u32(codepoint)?);
                }
                _ => return None,
            },
            other => output.push(other),
        }
    }

    None
}

fn json_escape(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '"' => output.push_str("\\\""),
            '\\' => output.push_str("\\\\"),
            '\n' => output.push_str("\\n"),
            '\r' => output.push_str("\\r"),
            '\t' => output.push_str("\\t"),
            character if character.is_control() => {
                use std::fmt::Write as _;
                let _ = write!(output, "\\u{:04x}", character as u32);
            }
            other => output.push(other),
        }
    }
    output
}

/// Resolves the Slur configuration directory for the current environment.
///
/// Resolution checks `SLUR_HOME`, the platform configuration variable, and
/// finally the user home directory.
pub fn config_dir() -> io::Result<PathBuf> {
    if let Some(path) = env::var_os("SLUR_HOME") {
        return Ok(PathBuf::from(path));
    }
    if let Some(path) = env::var_os("XDG_CONFIG_HOME") {
        return Ok(PathBuf::from(path).join("slur"));
    }
    if cfg!(windows)
        && let Some(path) = env::var_os("APPDATA")
    {
        return Ok(PathBuf::from(path).join("slur"));
    }
    env::var_os("HOME")
        .map(PathBuf::from)
        .map(|path| path.join(".config/slur"))
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "no config directory available"))
}

fn read_lines(path: &Path) -> io::Result<Vec<String>> {
    match fs::read_to_string(path) {
        Ok(contents) => Ok(contents
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
            .map(str::to_owned)
            .collect()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(error) => Err(error),
    }
}

fn clean_value(value: &str) -> io::Result<String> {
    let value = value.trim();
    if value.is_empty() || value.contains(['\n', '\r']) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "value must be one non-empty line",
        ));
    }
    Ok(value.to_owned())
}

fn append_unique(path: &Path, value: &str) -> io::Result<bool> {
    let value = clean_value(value)?;
    if read_lines(path)?
        .iter()
        .any(|item| item.eq_ignore_ascii_case(&value))
    {
        return Ok(false);
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    writeln!(file, "{value}")?;
    Ok(true)
}

fn remove_value(path: &Path, value: &str) -> io::Result<bool> {
    let value = clean_value(value)?;
    let current = read_lines(path)?;
    let kept = current
        .iter()
        .filter(|item| !item.eq_ignore_ascii_case(&value))
        .collect::<Vec<_>>();
    if current.len() == kept.len() {
        return Ok(false);
    }
    let mut output = kept
        .into_iter()
        .map(|line| line.as_str())
        .collect::<Vec<_>>()
        .join("\n");
    if !output.is_empty() {
        output.push('\n');
    }
    fs::write(path, output)?;
    Ok(true)
}

fn write_lines(path: &Path, values: &[String]) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut output = values.join("\n");
    if !output.is_empty() {
        output.push('\n');
    }
    fs::write(path, output)
}

fn seed() -> u64 {
    let clock = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos() as u64);
    clock ^ u64::from(std::process::id()).rotate_left(21)
}

struct FastRng(u64);

impl FastRng {
    fn new(seed: u64) -> Self {
        Self(seed | 1)
    }

    fn next(&mut self) -> u64 {
        let mut value = self.0;
        value ^= value >> 12;
        value ^= value << 25;
        value ^= value >> 27;
        self.0 = value;
        value.wrapping_mul(0x2545_f491_4f6c_dd1d)
    }

    fn index(&mut self, upper: usize) -> usize {
        ((self.next() as u128 * upper as u128) >> 64) as usize
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn deterministic_config(enabled: bool) -> Config {
        Config {
            root: PathBuf::new(),
            custom: vec!["EXPANDED".to_owned()],
            blocked: DEFAULT_PHRASES
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty() && !line.starts_with('#'))
                .map(str::to_owned)
                .collect(),
            enabled,
        }
    }

    #[test]
    fn blocks_case_insensitively() {
        let config = Config {
            root: PathBuf::new(),
            custom: vec!["A very specific roast.".to_owned()],
            blocked: vec!["ReTaRd".to_owned(), "specific".to_owned()],
            enabled: true,
        };
        let active = config.active_phrases();
        assert!(
            !active
                .iter()
                .any(|phrase| phrase.eq_ignore_ascii_case("retard"))
        );
        assert!(!active.iter().any(|phrase| phrase.contains("specific")));
    }

    #[test]
    fn emit_combines_between_one_and_five_terms() {
        let config = Config {
            root: PathBuf::new(),
            custom: Vec::new(),
            blocked: Vec::new(),
            enabled: true,
        };
        let batch = config.emit(64).expect("batch should emit");
        assert_eq!(batch.len(), 64);
        assert!(batch.iter().all(|phrase| {
            let words = phrase.split_whitespace().count();
            (MIN_WORDS..=MAX_WORDS).contains(&words)
        }));
    }

    #[test]
    fn disabled_config_refuses_to_emit() {
        let config = Config {
            root: PathBuf::new(),
            custom: Vec::new(),
            blocked: Vec::new(),
            enabled: false,
        };
        assert!(config.emit(1).is_err());
    }

    #[test]
    fn fresh_config_blocks_group_slurs_by_default() {
        let root = env::temp_dir().join(format!("slur-default-blocks-{}", seed()));
        let config = Config::from_root(root.clone()).expect("config should load");
        let active = config.active_phrases();

        for term in DEFAULT_BLOCKED {
            assert!(
                !active
                    .iter()
                    .any(|phrase| phrase.eq_ignore_ascii_case(term))
            );
        }

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn default_block_can_be_unblocked() {
        let root = env::temp_dir().join(format!("slur-unblock-default-{}", seed()));
        let mut config = Config::from_root(root.clone()).expect("config should load");

        assert!(config.unblock("nigga").expect("term should unblock"));
        let reloaded = Config::from_root(root.clone()).expect("config should reload");
        assert!(!reloaded.blocked.iter().any(|term| term == "nigga"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn extracts_hook_prompts() {
        let input = r#"{"prompt":"  \/slur\n","other":true}"#;
        assert_eq!(hook_prompt(input, "prompt").as_deref(), Some("  /slur\n"));
        assert!(is_slur_invocation(" /slur\n"));
        assert!(!is_slur_invocation("/slur add test"));
    }

    #[test]
    fn expands_each_inline_macro_without_touching_the_sentence() {
        let expanded = deterministic_config(true)
            .expand_prompt("You /slur your work sucks, you /slur.")
            .expect("expansion should succeed")
            .expect("macros should be found");

        assert_eq!(expanded, "You EXPANDED your work sucks, you EXPANDED.");
    }

    #[test]
    fn only_expands_standalone_macro_tokens() {
        let config = deterministic_config(true);
        assert_eq!(
            config
                .expand_prompt("(/slur), but not /slurred or https://example.com/slur")
                .expect("expansion should succeed")
                .as_deref(),
            Some("(EXPANDED), but not /slurred or https://example.com/slur")
        );
        assert_eq!(
            config
                .expand_prompt("nothing to expand")
                .expect("expansion should succeed"),
            None
        );
    }

    #[test]
    fn disabled_config_leaves_inline_macros_unchanged() {
        assert_eq!(
            deterministic_config(false)
                .expand_prompt("leave /slur alone")
                .expect("disabled expansion should be a no-op"),
            None
        );
    }

    #[test]
    fn hook_outputs_escape_generated_text() {
        let phrase = "quote \" slash \\ newline\n";
        assert!(codex_hook_output(phrase).contains("quote \\\" slash \\\\"));
        assert!(copilot_hook_output(phrase).contains("newline\\n"));
        assert!(cline_hook_output(phrase).contains("contextModification"));
    }
}
