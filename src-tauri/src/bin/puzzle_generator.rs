use serde::Serialize;
use spelling_bee_clone_lib::{puzzles::daily_puzzles, puzzles::Puzzle, Error};

#[derive(Serialize)]
struct Puzzles {
    day: u64,
    dailies: Vec<Puzzle>,
}

fn main() -> Result<(), Error> {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::SystemTime::UNIX_EPOCH)
        .or(Err(Error::Message(
            "Error getting duration since Unix epoch".into(),
        )))?
        .as_secs();
    let day = secs.next_multiple_of(60 * 60 * 24);
    let dailies = daily_puzzles(10)?;

    let puzzles = Puzzles { day, dailies };
    let puzzles = serde_json::to_string(&puzzles)?;
    std::fs::write("puzzles.json", puzzles).expect("Unable to write puzzles.json");

    Ok(())
}
