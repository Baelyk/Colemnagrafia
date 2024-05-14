use std::collections::HashSet;

use crate::{filter, parser};

pub fn generate() {
    let (words, pangrams) = generate_words_and_pangrams();
    write_palabras_rs(words, pangrams);
}

pub fn generate_words_and_pangrams() -> (Vec<(String, String)>, Vec<String>) {
    let elements = parser::parse_elementos();

    println!("Filtering words and common pangrams...");
    // List of *normalized* common pangrams for puzzle generation
    let mut pangrams: HashSet<String> = HashSet::new();
    // List of all words and their lemma
    let mut words: HashSet<(String, String)> = HashSet::new();
    elements
        .iter()
        .for_each(|(_, (element, lemma, category, freq, _, _))| {
            if lemma == &String::from("??")
                || unidecode::unidecode(lemma) != unidecode::unidecode(lemma).to_ascii_lowercase()
            {
                return;
            }
            // See if this is a valid word and common pangram
            let (valid, common_pangram) =
                filter(element, Some(lemma), Some(*category), *freq, true);
            if !valid {
                // If not valid, do a last check to see if its valid using its lemma's frequency
                let Some((_, _, _, lemma_freq, _, _)) = elements.get(lemma) else {
                    return;
                };
                let (valid_by_lemma, _) =
                    filter(element, Some(lemma), Some(*category), *lemma_freq, true);
                if !valid_by_lemma {
                    return;
                }
            }
            if common_pangram {
                pangrams.insert(unidecode::unidecode(element));
            }
            words.insert((element.to_string(), lemma.to_string()));
        });

    println!(
        "Found {} words and {} common pangrams",
        words.len(),
        pangrams.len()
    );

    println!("Sorting...");
    let mut pangrams: Vec<String> = pangrams.into_iter().collect();
    pangrams.sort();
    let mut words: Vec<(String, String)> = words.into_iter().collect();
    words.sort();

    (words, pangrams)
}

fn write_palabras_rs(words: Vec<(String, String)>, pangrams: Vec<String>) {
    println!("Writing palabras.rs...");
    // Words
    let mut palabras_rs = format!(
        "pub const PALABRAS: &[(&str, &str); {}] = &[\n",
        words.len()
    );
    words
        .iter()
        .for_each(|word| palabras_rs.push_str(&format!("    {:?},\n", word)));
    palabras_rs.push_str("];\n\n");
    // Pangrams
    palabras_rs.push_str(&format!(
        "pub const PANGRAMS: &[&str; {}] = &[\n",
        pangrams.len()
    ));
    pangrams
        .iter()
        .for_each(|word| palabras_rs.push_str(&format!("    {:?},\n", word)));
    palabras_rs.push_str("];\n");
    std::fs::write("palabras.rs", palabras_rs).expect("Unable to write palabras.rs");
}
