use puzzles::Puzzle;

mod palabras;
pub mod puzzles;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![daily_puzzle])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Serde(#[from] serde_json::error::Error),
    #[error("{0}")]
    Message(String),
    #[error("BadPuzzle: {0}")]
    BadPuzzle(String),
}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[tauri::command]
async fn create_puzzle_from_letters(letters: Vec<char>) -> Result<Puzzle, Error> {
    puzzles::create_puzzle_from_letters(letters)
}

#[tauri::command]
async fn daily_puzzle() -> Result<Puzzle, Error> {
    match puzzles::daily_puzzles(0) {
        Ok(puzzles) => Ok(puzzles[0].clone()),
        Err(error) => Err(error),
    }
}
