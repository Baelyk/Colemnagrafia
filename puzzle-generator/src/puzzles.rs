use rand::{seq::SliceRandom, SeedableRng};
use rand_chacha::ChaCha8Rng;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use unidecode::unidecode;
use wasm_bindgen::prelude::*;

use crate::palabras;
use crate::Error;

#[derive(Clone, Deserialize, Serialize)]
#[wasm_bindgen]
pub struct Puzzle {
    letters: Vec<char>,
    words: HashMap<String, HashSet<String>>,
    lemmas: HashMap<String, String>,
    forms: HashMap<String, HashSet<String>>,
    pangrams: Vec<String>,
}

pub fn create_puzzle_from_letters(letters: Vec<char>) -> Result<Puzzle, Error> {
    let all_words = palabras::PALABRAS;

    let letter_set: HashSet<char> = HashSet::from_iter(letters.iter().copied());

    println!("Trying {:?}", letters);

    // Map form -> normalized lema, of all the words in the puzzle
    let words: HashMap<String, String> = all_words
        .iter()
        .filter(|(form, _)| {
            let form = unidecode(form);

            let mut contains_center = false;
            form.chars().all(|c| {
                if c == letters[0] {
                    contains_center = true;
                }
                letter_set.contains(&c)
            }) && contains_center
        })
        .map(|(form, lema)| (form.to_string(), lema.to_string()))
        .collect();

    let pangrams: Vec<String> = words
        .iter()
        .filter(|(form, _)| {
            let set: HashSet<char> = HashSet::from_iter(unidecode(form).chars());
            set.len() == 7
        })
        .map(|(form, _)| form.to_string())
        .collect();

    if words.len() < 25 {
        println!(
            "Failed, only found {} words from {:?}",
            words.len(),
            letters
        );
        return Err(Error::BadPuzzle("Too few words".into()));
    }

    if words.len() > 100 {
        println!(
            "Failed, found too many words ({}) from {:?}",
            words.len(),
            letters
        );
        return Err(Error::BadPuzzle("Too many words".into()));
    }

    println!(
        "Created a puzzle with {} words and {} pangrams: \n\t{:?}",
        words.len(),
        pangrams.len(),
        letters
    );

    // Map normalized word -> denormalized forms, e.g. papa -> [papa, papá]
    let mut accent_map: HashMap<String, HashSet<String>> = HashMap::new();
    // Map (*not* normalized) form -> lemma
    let mut lemma_map: HashMap<String, String> = HashMap::new();
    // Map lemma -> all associated forms
    let mut forms_map: HashMap<String, HashSet<String>> = HashMap::new();
    words.iter().for_each(|(form, lemma)| {
        // Get the normalized form of this word for the accent map
        let stripped = unidecode(form);
        accent_map.entry(stripped).or_default().insert(form.clone());

        // Map this form to its lemma
        lemma_map.insert(form.clone(), lemma.clone());

        // Add this form to its lemma's list of forms
        forms_map
            .entry(lemma.clone())
            .or_default()
            .insert(form.clone());
    });

    Ok(Puzzle {
        letters,
        words: accent_map,
        lemmas: lemma_map,
        forms: forms_map,
        pangrams,
    })
}

pub fn daily_puzzle(day: u64) -> Result<Puzzle, Error> {
    println!("Creating daily puzzle for day {}", day);

    // Create a random number generator seeded by days since the epoch
    let seed = day;
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
        puzzle = create_puzzle_from_letters(letters);
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
    println!("Took {} tries to create a puzzle", tries);

    puzzle
}
