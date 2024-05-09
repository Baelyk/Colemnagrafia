use clap::Parser;
use std::io::BufReader;
use std::path::PathBuf;
use std::{collections::HashMap, fs::File};

/// Script to generate puzzles.json
#[derive(Parser, Debug)]
struct Args {
    /// Path to puzzles.json to write to, and read from and update if it exists
    path: Option<PathBuf>,
    /// Number of puzzles to generate
    #[arg(short, long, default_value_t = 1)]
    num: u64,
}

use spelling_bee_clone_lib::{puzzles::daily_puzzle, puzzles::Puzzle, utils, Error};

type Puzzles = HashMap<u64, Puzzle>;

fn main() -> Result<(), Error> {
    let args = Args::parse();

    let mut puzzles: Puzzles = HashMap::new();
    if let Some(path) = &args.path {
        if let Ok(file) = File::open(path) {
            let reader = BufReader::new(file);
            puzzles = serde_json::from_reader(reader)?;
            println!("Loaded {} puzzles from {}", puzzles.len(), path.display());
        } else {
            println!("Unable to access {}, ignoring", path.display());
        }
    }

    let today = utils::today()?;
    println!("Generating {} puzzles from today ({})", args.num, today);
    for i in 0..args.num {
        if let Ok(puzzle) = daily_puzzle(today + i) {
            puzzles.insert(today + i, puzzle);
        }
    }
    println!(
        "Generated {} puzzles for a total of {}",
        args.num,
        puzzles.len()
    );

    let path = args.path.unwrap_or("puzzles.json".into());
    println!("Writing puzzles to {}", path.display());

    let puzzles = serde_json::to_string(&puzzles)?;
    std::fs::write(path, puzzles).expect("Unable to write puzzles.json");

    Ok(())
}
