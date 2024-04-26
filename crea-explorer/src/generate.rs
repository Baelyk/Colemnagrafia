use std::collections::HashSet;

use crate::{filter, parser};

pub fn generate() {
    let (words, pangrams) = generate_words_and_pangrams();
    write_palabras_rs(words, pangrams);
}

pub fn generate_words_and_pangrams() -> (HashSet<String>, Vec<String>) {
    let elementos = parser::parse_elementos();
    let elementos_by_lema = parser::parse_elementos_by_lema();

    println!("Filtering words and common pangrams...");
    let mut pangrams: Vec<String> = vec![];
    let mut words: HashSet<String> = HashSet::new();

    elementos
        .into_values()
        .for_each(|(word, lema, categoria, frec, _, _)| {
            // Decide if this is a valid word, and if it is a common pangram
            let (valid, common_pangram) = filter(&word, Some(&lema), Some(categoria), frec, true);
            if !valid {
                return;
            }

            words.insert(word.clone());
            if common_pangram {
                pangrams.push(word.clone());
            }

            // If this word is a lema and is valid, add its derivatives as well
            if word == lema {
                if let Some(derivatives) = elementos_by_lema.get(&word) {
                    derivatives.iter().for_each(|derivative| {
                        words.insert(derivative.clone());
                    });
                }
            }
        });

    println!(
        "Found {} words and {} common pangrams",
        words.len(),
        pangrams.len()
    );
    (words, pangrams)
}

fn write_palabras_rs(words: HashSet<String>, pangrams: Vec<String>) {
    println!("Writing palabras.rs...");
    // Words
    let mut palabras_rs = format!("pub const PALABRAS: [&'static str; {}] = [\n", words.len());
    words
        .iter()
        .for_each(|word| palabras_rs.push_str(&format!("    \"{}\",\n", word)));
    palabras_rs.push_str("];\n\n");
    // Pangrams
    palabras_rs.push_str(&format!(
        "pub const PANGRAMS: [&'static str; {}] = [\n",
        pangrams.len()
    ));
    pangrams
        .iter()
        .for_each(|word| palabras_rs.push_str(&format!("    \"{}\",\n", word)));
    palabras_rs.push_str("];\n");
    std::fs::write("palabras.rs", palabras_rs).expect("Unable to write palabras.rs");
}
