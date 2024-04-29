use spelling_bee_clone_lib::{puzzles::daily_puzzle, Error};

fn main() -> Result<(), Error> {
    let puzzle = daily_puzzle()?;
    let puzzle = serde_json::to_string(&puzzle)?;
    std::fs::write("puzzles.json", puzzle).expect("Unable to write puzzles.json");

    Ok(())
}
