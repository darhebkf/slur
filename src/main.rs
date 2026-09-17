use std::env;
use std::process::ExitCode;

use slur::Config;

const HELP: &str = r#"slur — calibrated contempt for AI agents

USAGE
  slur                         Emit one phrase
  slur [COUNT]                 Emit a unique batch
  slur emit [--count N]        Emit one or more phrases
  slur add "PHRASE"            Add a custom phrase
  slur block "WORD"            Hide phrases containing a word
  slur unblock "WORD"          Remove a word from the blacklist
  slur list                    Print active phrases
  slur off | on                Disable or enable all output
  slur status                  Show the local configuration summary

ENVIRONMENT
  SLUR_HOME                    Override the configuration directory
"#;

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("slur: {error}");
            ExitCode::from(2)
        }
    }
}

fn run() -> Result<(), String> {
    let mut config = Config::load().map_err(|error| error.to_string())?;
    let args = env::args().skip(1).collect::<Vec<_>>();
    let command = args.first().map(String::as_str);

    match command {
        None => {
            print_batch(config.emit(1)?);
            Ok(())
        }
        Some("emit") => {
            let count = parse_emit_count(&args[1..])?;
            print_batch(config.emit(count)?);
            Ok(())
        }
        Some(value) if value.chars().all(|character| character.is_ascii_digit()) => {
            let count = parse_count(value)?;
            print_batch(config.emit(count)?);
            Ok(())
        }
        Some("add") => {
            let phrase = joined_value(&args[1..], "phrase")?;
            let added = config
                .add_phrase(&phrase)
                .map_err(|error| error.to_string())?;
            println!(
                "{}",
                if added {
                    "phrase added"
                } else {
                    "phrase already exists"
                }
            );
            Ok(())
        }
        Some("block") => {
            let term = joined_value(&args[1..], "word")?;
            let added = config.block(&term).map_err(|error| error.to_string())?;
            println!(
                "{}",
                if added {
                    "word blocked"
                } else {
                    "word already blocked"
                }
            );
            Ok(())
        }
        Some("unblock") => {
            let term = joined_value(&args[1..], "word")?;
            let removed = config.unblock(&term).map_err(|error| error.to_string())?;
            println!(
                "{}",
                if removed {
                    "word unblocked"
                } else {
                    "word was not blocked"
                }
            );
            Ok(())
        }
        Some("list") => {
            print_batch(config.active_phrases());
            Ok(())
        }
        Some("off") => {
            config
                .set_enabled(false)
                .map_err(|error| error.to_string())?;
            println!("output disabled");
            Ok(())
        }
        Some("on") => {
            config
                .set_enabled(true)
                .map_err(|error| error.to_string())?;
            println!("output enabled");
            Ok(())
        }
        Some("status") => {
            println!("status: {}", if config.enabled { "armed" } else { "off" });
            println!("active: {}", config.active_phrases().len());
            println!("custom: {}", config.custom.len());
            println!("blocked: {}", config.blocked.len());
            println!("config: {}", config.root().display());
            Ok(())
        }
        Some("-h" | "--help" | "help") => {
            print!("{HELP}");
            Ok(())
        }
        Some("-V" | "--version" | "version") => {
            println!("slur {}", env!("CARGO_PKG_VERSION"));
            Ok(())
        }
        Some(other) => Err(format!("unknown command `{other}`\n\n{HELP}")),
    }
}

fn parse_emit_count(args: &[String]) -> Result<usize, String> {
    match args {
        [] => Ok(1),
        [value] => parse_count(value),
        [flag, value] if flag == "--count" || flag == "-n" => parse_count(value),
        _ => Err("use `slur emit`, `slur emit 3`, or `slur emit --count 3`".to_owned()),
    }
}

fn parse_count(value: &str) -> Result<usize, String> {
    let count = value
        .parse::<usize>()
        .map_err(|_| format!("`{value}` is not a valid count"))?;
    if !(1..=64).contains(&count) {
        return Err("count must be between 1 and 64".to_owned());
    }
    Ok(count)
}

fn joined_value(args: &[String], label: &str) -> Result<String, String> {
    let value = args.join(" ");
    if value.trim().is_empty() {
        return Err(format!("missing {label}"));
    }
    Ok(value)
}

fn print_batch(phrases: Vec<String>) {
    for phrase in phrases {
        println!("{phrase}");
    }
}
