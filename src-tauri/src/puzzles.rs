use rand::{seq::SliceRandom, SeedableRng};
use rand_chacha::ChaCha8Rng;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use unidecode::unidecode;

use crate::palabras;
use crate::Error;

#[derive(Clone, Deserialize, Serialize)]
pub struct Puzzle {
    letters: Vec<char>,
    words: HashMap<String, String>,
    lemmas: HashMap<String, HashSet<String>>,
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
        .map(|(form, lema)| (form.to_string(), unidecode(lema)))
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

    // Map normalized form -> normalized lema for the lema map, will be used to take puzzle input,
    // which will be normalized, to get the lema to use in the lema map to get all the associated
    // forms (including e.g. papa and papá, which aren't associated lema wise but are associated
    // accent wise.)
    let mut word_map: HashMap<String, String> = HashMap::new();
    // Map normalized lema -> all associated forms (e.g. papa includes papa and papá)
    let mut lema_map: HashMap<String, HashSet<String>> = HashMap::new();
    words.iter().for_each(|(form, lema)| {
        // Get the stripped lema for this word by first checking if there is a stripped form in the
        // words map, and using that lema (already stripped). Otherwise, use this word's lema
        // (already stripped).
        let stripped_lema = words.get(&unidecode(form)).unwrap_or(lema).to_string();
        // Note this words stripped lema
        word_map.insert(unidecode(form), stripped_lema.clone());
        // Add this form to this stripped lema's form list
        lema_map
            .entry(stripped_lema)
            .or_default()
            .insert(form.to_string());
    });

    Ok(Puzzle {
        letters,
        words: word_map,
        lemmas: lema_map,
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
