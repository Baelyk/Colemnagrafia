use rand::Rng;
use unidecode::unidecode;

use std::collections::HashSet;

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

const LETTERS: [char; 26] = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
    'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];

#[tauri::command]
async fn new_puzzle() -> ([char; 7], Vec<String>) {
    let all_words = std::fs::read_to_string("../0_palabras_todas_no_conjugaciones.txt")
        .expect("Error loading words");

    let mut letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    let mut letter_set: HashSet<char> = HashSet::from_iter(letters.iter().copied());

    let mut words = vec![];
    let mut tries = 0;

    loop {
        tries += 1;

        letter_set.drain();
        loop {
            let i = rand::thread_rng().gen_range(0..26);

            if !letter_set.contains(&LETTERS[i]) {
                letters[letter_set.len()] = LETTERS[i];
                letter_set.insert(LETTERS[i]);
            }

            if letter_set.len() == 7 {
                break;
            }
        }

        println!("Trying {:?}", letter_set);

        words = all_words
            .lines()
            .filter(|word| {
                let word = unidecode(word);
                if word.chars().count() < 4 {
                    return false;
                }
                let mut contains_center = false;
                word.chars().all(|c| {
                    if c == letters[0] {
                        contains_center = true;
                    }
                    letter_set.contains(&c.to_ascii_uppercase())
                })
            })
            .map(|word| word.to_owned())
            .collect();

        let pangram = words.iter().any(|word| {
            let set: HashSet<char> = HashSet::from_iter(unidecode(word).chars());
            set.len() == 7
        });

        if words.len() > 0 {
            break;
        }

        if pangram {
            break;
        }

        if tries > 100 {
            println!("Too many tries!");
            break;
        }
    }

    //words.iter().for_each(|word| println!("{}", word));
    println!(
        "After {} tries, found a puzzle with {} words: \n\t{:?}",
        tries,
        words.len(),
        letters
    );

    return (letters, words);
}
