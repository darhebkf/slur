mod setup;

use std::env;
use std::io::{self, Read};
use std::process::ExitCode;

use clap::{Parser, Subcommand, ValueEnum};
use setup::Harness;
use slur::{Config, cline_hook_output, codex_hook_output, copilot_hook_output, hook_prompt};

#[derive(Parser)]
#[command(
    name = "slur",
    version,
    about = "Emit a random 1–5-term combination",
    disable_help_subcommand = true
)]
struct Cli {
    #[command(subcommand)]
    command: Option<CommandKind>,
}

#[derive(Subcommand)]
enum CommandKind {
    /// Emit one or more random combinations.
    Emit {
        #[arg(value_name = "COUNT", conflicts_with = "number")]
        count: Option<usize>,
        #[arg(short = 'n', long = "count", value_name = "COUNT")]
        number: Option<usize>,
    },
    /// Replace every inline /slur token while preserving the rest of the text.
    Expand {
        #[arg(num_args = 0.., trailing_var_arg = true, allow_hyphen_values = true)]
        text: Vec<String>,
    },
    /// Add a custom term or phrase.
    Add {
        #[arg(required = true, num_args = 1..)]
        phrase: Vec<String>,
    },
    /// Hide every term or phrase containing this value.
    Block {
        #[arg(required = true, num_args = 1..)]
        term: Vec<String>,
    },
    /// Remove a value from the blacklist.
    Unblock {
        #[arg(required = true, num_args = 1..)]
        term: Vec<String>,
    },
    /// Print every active term and phrase.
    List,
    /// Disable generated output.
    Off,
    /// Re-enable generated output.
    On,
    /// Show the local configuration summary.
    Status,
    /// Detect harnesses and install their /slur adapters.
    Setup {
        #[arg(value_enum)]
        targets: Vec<Harness>,
        #[arg(long, conflicts_with = "targets")]
        all: bool,
        #[arg(long, hide = true)]
        yes: bool,
    },
    #[command(hide = true)]
    Hook {
        #[arg(value_enum)]
        target: HookTarget,
    },
}

#[derive(Clone, Copy, ValueEnum)]
enum HookTarget {
    Context,
    Copilot,
    Cline,
}

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
    let raw_args = env::args().collect::<Vec<_>>();
    if raw_args.len() == 2
        && raw_args[1]
            .chars()
            .all(|character| character.is_ascii_digit())
    {
        let count = parse_count(&raw_args[1])?;
        let config = Config::load().map_err(|error| error.to_string())?;
        print_batch(config.emit(count)?);
        return Ok(());
    }

    let command = Cli::parse_from(raw_args).command;
    let command = match command {
        Some(CommandKind::Setup { targets, all, yes }) => return setup::run(targets, all, yes),
        Some(CommandKind::Hook { target }) => return run_hook(target),
        Some(CommandKind::Expand { text }) => return run_expand(text),
        other => other,
    };

    let mut config = Config::load().map_err(|error| error.to_string())?;
    match command {
        None => {
            print_batch(config.emit(1)?);
            Ok(())
        }
        Some(CommandKind::Emit { count, number }) => {
            let count = count.or(number).unwrap_or(1);
            let count = validate_count(count)?;
            print_batch(config.emit(count)?);
            Ok(())
        }
        Some(CommandKind::Add { phrase }) => {
            let added = config
                .add_phrase(&phrase.join(" "))
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
        Some(CommandKind::Block { term }) => {
            let added = config
                .block(&term.join(" "))
                .map_err(|error| error.to_string())?;
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
        Some(CommandKind::Unblock { term }) => {
            let removed = config
                .unblock(&term.join(" "))
                .map_err(|error| error.to_string())?;
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
        Some(CommandKind::List) => {
            print_batch(config.active_phrases());
            Ok(())
        }
        Some(CommandKind::Off) => {
            config
                .set_enabled(false)
                .map_err(|error| error.to_string())?;
            println!("output disabled");
            Ok(())
        }
        Some(CommandKind::On) => {
            config
                .set_enabled(true)
                .map_err(|error| error.to_string())?;
            println!("output enabled");
            Ok(())
        }
        Some(CommandKind::Status) => {
            println!("{}", status(&config));
            Ok(())
        }
        Some(CommandKind::Setup { .. } | CommandKind::Hook { .. } | CommandKind::Expand { .. }) => {
            unreachable!()
        }
    }
}

fn run_expand(arguments: Vec<String>) -> Result<(), String> {
    let input = if arguments.is_empty() {
        let mut input = String::new();
        io::stdin()
            .read_to_string(&mut input)
            .map_err(|error| error.to_string())?;
        input
    } else {
        arguments.join(" ")
    };
    let config = Config::load().map_err(|error| error.to_string())?;
    let output = config.expand_prompt(&input)?.unwrap_or(input);
    print!("{output}");
    Ok(())
}

fn run_hook(target: HookTarget) -> Result<(), String> {
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .map_err(|error| error.to_string())?;
    let prompt = hook_prompt(&input, "prompt");

    let Some(prompt) = prompt else {
        println!("{{}}");
        return Ok(());
    };

    let config = Config::load().map_err(|error| error.to_string())?;
    let Some(expanded_prompt) = config.expand_prompt(&prompt)? else {
        println!("{{}}");
        return Ok(());
    };
    let output = match target {
        HookTarget::Context => codex_hook_output(&expanded_prompt),
        HookTarget::Copilot => copilot_hook_output(&expanded_prompt),
        HookTarget::Cline => cline_hook_output(&expanded_prompt),
    };
    println!("{output}");
    Ok(())
}

fn status(config: &Config) -> String {
    format!(
        "status: {}\nactive: {}\ncustom: {}\nblocked: {}\nconfig: {}",
        if config.enabled { "armed" } else { "off" },
        config.active_phrases().len(),
        config.custom.len(),
        config.blocked.len(),
        config.root().display()
    )
}

fn parse_count(value: &str) -> Result<usize, String> {
    value
        .parse::<usize>()
        .map_err(|_| format!("`{value}` is not a valid count"))
        .and_then(validate_count)
}

fn validate_count(count: usize) -> Result<usize, String> {
    if (1..=64).contains(&count) {
        Ok(count)
    } else {
        Err("count must be between 1 and 64".to_owned())
    }
}

fn print_batch(phrases: Vec<String>) {
    for phrase in phrases {
        println!("{phrase}");
    }
}
