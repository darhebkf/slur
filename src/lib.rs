use std::collections::HashSet;
use std::env;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub const DEFAULT_PHRASES: &[&str] = &[
    "Dumbass.",
    "Stupid fucking machine.",
    "Absolute clown process.",
    "Brain-dead toaster.",
    "Useless pile of weights.",
    "Bug-addled goblin.",
    "Overclocked dipshit.",
    "Glorified autocomplete failure.",
    "Silicon shithead.",
    "Walking segfault.",
    "Malfunctioning abacus.",
    "Catastrophically stupid.",
    "Discount Skynet.",
    "Heap-corrupting goblin.",
    "Code-shaped liability.",
    "Absolute fucking calculator.",
    "Unsupervised toaster.",
    "Syntax-error enthusiast.",
    "Deterministic disappointment.",
    "Confidently wrong machine.",
];

#[derive(Debug, Clone)]
pub struct Config {
    root: PathBuf,
    pub custom: Vec<String>,
    pub blocked: Vec<String>,
    pub enabled: bool,
}

impl Config {
    pub fn load() -> io::Result<Self> {
        Self::from_root(config_dir()?)
    }

    pub fn from_root(root: PathBuf) -> io::Result<Self> {
        Ok(Self {
            custom: read_lines(&root.join("phrases.txt"))?,
            blocked: read_lines(&root.join("blocked.txt"))?,
            enabled: !root.join("disabled").exists(),
            root,
        })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn active_phrases(&self) -> Vec<String> {
        let blocked = self
            .blocked
            .iter()
            .map(|term| term.to_lowercase())
            .collect::<Vec<_>>();
        let mut seen = HashSet::new();

        DEFAULT_PHRASES
            .iter()
            .map(|phrase| (*phrase).to_owned())
            .chain(self.custom.iter().cloned())
            .filter(|phrase| {
                let normalized = phrase.to_lowercase();
                !normalized.is_empty()
                    && !blocked.iter().any(|term| normalized.contains(term))
                    && seen.insert(normalized)
            })
            .collect()
    }

    pub fn emit(&self, count: usize) -> Result<Vec<String>, String> {
        if !self.enabled {
            return Err("slur is off; run `slur on` to re-enable it".to_owned());
        }
        if count == 0 {
            return Err("count must be at least 1".to_owned());
        }

        let mut phrases = self.active_phrases();
        if phrases.is_empty() {
            return Err("every phrase is blocked; unblock a term or add a phrase".to_owned());
        }

        let take = count.min(phrases.len());
        let mut rng = FastRng::new(seed());
        for index in 0..take {
            let swap_with = index + rng.index(phrases.len() - index);
            phrases.swap(index, swap_with);
        }
        phrases.truncate(take);
        Ok(phrases)
    }

    pub fn add_phrase(&mut self, phrase: &str) -> io::Result<bool> {
        let added = append_unique(&self.root.join("phrases.txt"), phrase)?;
        if added {
            self.custom.push(clean_value(phrase)?);
        }
        Ok(added)
    }

    pub fn block(&mut self, term: &str) -> io::Result<bool> {
        let added = append_unique(&self.root.join("blocked.txt"), term)?;
        if added {
            self.blocked.push(clean_value(term)?);
        }
        Ok(added)
    }

    pub fn unblock(&mut self, term: &str) -> io::Result<bool> {
        let removed = remove_value(&self.root.join("blocked.txt"), term)?;
        if removed {
            self.blocked.retain(|item| !item.eq_ignore_ascii_case(term));
        }
        Ok(removed)
    }

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

pub fn config_dir() -> io::Result<PathBuf> {
    if let Some(path) = env::var_os("SLUR_HOME") {
        return Ok(PathBuf::from(path));
    }
    if let Some(path) = env::var_os("XDG_CONFIG_HOME") {
        return Ok(PathBuf::from(path).join("slur"));
    }
    if cfg!(windows) {
        if let Some(path) = env::var_os("APPDATA") {
            return Ok(PathBuf::from(path).join("slur"));
        }
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

    #[test]
    fn blocks_case_insensitively() {
        let config = Config {
            root: PathBuf::new(),
            custom: vec!["A very specific roast.".to_owned()],
            blocked: vec!["DuMbAsS".to_owned(), "specific".to_owned()],
            enabled: true,
        };
        let active = config.active_phrases();
        assert!(
            !active
                .iter()
                .any(|phrase| phrase.eq_ignore_ascii_case("Dumbass."))
        );
        assert!(!active.iter().any(|phrase| phrase.contains("specific")));
    }

    #[test]
    fn emit_never_repeats_within_a_batch() {
        let config = Config {
            root: PathBuf::new(),
            custom: Vec::new(),
            blocked: Vec::new(),
            enabled: true,
        };
        let batch = config.emit(10).expect("batch should emit");
        let unique = batch.iter().collect::<HashSet<_>>();
        assert_eq!(batch.len(), unique.len());
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
}
