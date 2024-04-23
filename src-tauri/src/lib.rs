use rand::{seq::SliceRandom, SeedableRng};
use rand_chacha::ChaCha8Rng;
use unidecode::unidecode;

use std::collections::{HashMap, HashSet};

mod palabras;

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
enum Error {
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
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
async fn create_puzzle_from_letters(
    letters: Vec<char>,
) -> Result<(Vec<char>, HashMap<String, HashSet<String>>, Vec<String>), Error> {
    let all_words = palabras::PALABRAS;

    let words: Vec<String>;
    let pangrams: Vec<String>;

    let letter_set: HashSet<char> = HashSet::from_iter(letters.iter().copied());

    println!("Trying {:?}", letters);

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

    if words.len() <= 20 {
        println!(
            "Failed, only found {} words from {:?}",
            words.len(),
            letters
        );
        return Err(Error::BadPuzzle("Too few words".into()));
    }

    println!(
        "Created a puzzle with {} words and {} pangrams: \n\t{:?}",
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

#[tauri::command]
async fn daily_puzzle() -> Result<(Vec<char>, HashMap<String, HashSet<String>>, Vec<String>), Error>
{
    // Create a random number generator seeded by today's seconds since the Unix
    // epoch
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::SystemTime::UNIX_EPOCH)
        .or(Err(Error::Message(
            "Error getting duration since Unix epoch".into(),
        )))?
        .as_secs();
    let seed = secs.next_multiple_of(60 * 60 * 24);
    let mut rng = ChaCha8Rng::seed_from_u64(seed);

    let all_pangrams = palabras::PANGRAMS;

    let mut pangram;
    let mut letters: Vec<char>;

    let mut tries = 0;
    let mut puzzle;

    loop {
        tries += 1;

        // Choose a random pangram
        let Some(chosen_pangram) = all_pangrams.choose(&mut rng) else {
            return Err(Error::Message("No pangrams to choose from".into()));
        };
        pangram = chosen_pangram;

        // Extract the unique letters from the pangram and shuffle to pick the
        // center letter. Sort first so that the seedable RNG's determinism is
        // not affect by the HashSet
        let letter_set: HashSet<char> = HashSet::from_iter(unidecode(pangram).chars());
        letters = letter_set.iter().copied().collect();
        letters.sort();
        letters.shuffle(&mut rng);

        println!("Trying {:?} from {}", letters, pangram);

        // Try to create the puzzle, and keep try again if these letters make a
        // bad puzzle
        puzzle = create_puzzle_from_letters(letters).await;
        match puzzle {
            Err(Error::BadPuzzle(message)) => println!("Bad puzzle: {}", message),
            _ => break,
        };

        if tries > 100 {
            return Err(Error::Message(
                "Too many tries, failed to find puzzle".into(),
            ));
        }
    }

    puzzle
}
