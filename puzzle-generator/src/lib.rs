use wasm_bindgen::prelude::*;

pub mod puzzles;
pub mod utils;

#[derive(Debug, thiserror::Error)]
pub enum Error {
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

#[wasm_bindgen(js_name = "dailyPuzzle")]
pub async fn daily_puzzle(day: u32) -> Result<String, String> {
    puzzles::daily_puzzle(day.into())
        .and_then(|puzzle| Ok(serde_json::to_string(&puzzle)?))
        .or_else(|err| Err(err.to_string()))
}
