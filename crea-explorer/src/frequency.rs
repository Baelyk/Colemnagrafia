use crate::{
    filter, generate,
    parser::{self, ElementoRecord},
};

pub fn frequency(min_freq: usize, words: usize) {
    let elementos = parser::parse_elementos();
    let (included_words, _) = generate::generate_words_and_pangrams();

    println!(
        "Exploring {} omitted words with frequency less than {}",
        words, min_freq
    );

    let mut omitted: Vec<(String, ElementoRecord)> = elementos
        .into_iter()
        // Only care about words that filted due to their frequency
        .filter(|(word, (_, lema, cat, _, _, _))| {
            filter(word, Some(lema), Some(*cat), usize::MAX, true).0
        })
        // Second pass to ignore words derived from valid lemas
        .filter(|(word, (_, lema, _, _, _, _))| {
            !included_words.contains(&(word.clone(), lema.clone()))
        })
        .filter(|(_, (_, _, _, freq, _, _))| *freq < min_freq)
        .collect();
    omitted.sort_by_key(|(_, (_, _, _, freq, _, _))| std::cmp::Reverse(*freq));
    omitted.truncate(words);
    let width = omitted
        .iter()
        .map(|(word, _)| word.chars().count())
        .max()
        .unwrap_or(0);
    omitted
        .iter()
        .for_each(|(word, record)| println!("{:<width$} {:?}", word, record));
}

// Maybe filter words by applying the current filter to lemas, and then go to elementos and find
// all the elementos that have that lema. Should help with getting conjugations and stuff without
// letting in the garbage.
//
// Also, maybe identify the frequency filter by going until the first frequency whose lema cannot
// be found on the RAE?
