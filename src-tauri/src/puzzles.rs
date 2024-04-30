use rand::{seq::SliceRandom, SeedableRng};
use rand_chacha::ChaCha8Rng;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use unidecode::unidecode;

use crate::palabras;
use crate::Error;

type WordMap = HashMap<String, HashSet<String>>;
#[derive(Clone, Serialize)]
pub struct Puzzle {
    letters: Vec<char>,
    words: WordMap,
    pangrams: Vec<String>,
}

pub fn create_puzzle_from_letters(letters: Vec<char>) -> Result<Puzzle, Error> {
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

    // Now convert raw words into the deaccented word map
    let mut word_map = HashMap::new();
    words.into_iter().for_each(|word| {
        let stripped = unidecode(&word);
        word_map
            .entry(stripped)
            .or_insert(HashSet::new())
            .insert(word);
    });

    Ok(Puzzle {
        letters,
        words: word_map,
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
