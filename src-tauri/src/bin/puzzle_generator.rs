use std::collections::HashMap;

use spelling_bee_clone_lib::{puzzles::daily_puzzle, puzzles::Puzzle, utils, Error};

type Puzzles = HashMap<u64, Puzzle>;

fn main() -> Result<(), Error> {
    let mut puzzles: Puzzles = HashMap::new();
    let today = utils::today()?;
    println!("Generating 10 puzzles from today ({})", today);

    for i in 0..10 {
        if let Ok(puzzle) = daily_puzzle(today + i) {
            puzzles.insert(today + i, puzzle);
        }
    }

    let puzzles = serde_json::to_string(&puzzles)?;
    std::fs::write("puzzles.json", puzzles).expect("Unable to write puzzles.json");

    Ok(())
}
