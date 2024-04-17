use rand::seq::SliceRandom;
use tauri::Manager;
use unidecode::unidecode;

use std::collections::{HashMap, HashSet};

mod palabras;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet, new_puzzle])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(Debug, thiserror::Error)]
enum Error {
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Message(String),
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
async fn new_puzzle() -> Result<(Vec<char>, HashMap<String, HashSet<String>>, Vec<String>), Error> {
    let all_words = palabras::PALABRAS;
    let all_pangrams = palabras::PANGRAMS;

    let mut pangram;
    let mut letters: Vec<char>;

    let mut words: Vec<String>;
    let mut pangrams: Vec<String>;
    let mut tries = 0;

    loop {
        tries += 1;

        // Choose a random pangram
        let Some(chosen_pangram) = all_pangrams.choose(&mut rand::thread_rng()) else {
            return Err(Error::Message("No pangrams to choose from".into()));
        };
        pangram = chosen_pangram;

        // Extract the unique letters from the pangram and shuffle to pick the
        // center letter
        let letter_set: HashSet<char> = HashSet::from_iter(unidecode(pangram).chars());
        letters = letter_set.iter().copied().collect();
        letters.shuffle(&mut rand::thread_rng());

        println!("Trying {:?} from {}", letters, pangram);

        words = all_words
            .iter()
            .filter(|word| {
                let word = unidecode(word);

                let mut contains_center = false;
                word.chars().all(|c| {
                    if c == letters[0] {
                        contains_center = true;
                    }
                    letter_set.contains(&c)
                }) && contains_center
            })
            .map(|word| word.to_string())
            .collect();

        pangrams = words
            .iter()
            .filter(|word| {
                let set: HashSet<char> = HashSet::from_iter(unidecode(word).chars());
                set.len() == 7
            })
            .cloned()
            .collect();

        if words.len() >= 20 {
            break;
        } else {
            println!("Failed, only found {} words from {}", words.len(), pangram);
        }

        if tries > 1 {
            println!("Too many tries!");
            break;
        }
    }

    println!(
        "After {} tries, found a puzzle with {} words and {} pangrams: \n\t{:?}",
        tries,
        words.len(),
        pangrams.len(),
        letters
    );

    // Now convert raw words into the deaccented word map
    let mut word_map = HashMap::new();
    words.into_iter().for_each(|word| {
        let stripped = unidecode(&word);
        word_map
            .entry(stripped)
            .or_insert(HashSet::new())
            .insert(word);
    });

    Ok((letters, word_map, pangrams))
}
