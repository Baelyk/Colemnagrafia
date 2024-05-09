use std::collections::HashSet;

use crate::{filter, parser};

pub fn generate() {
    let (words, pangrams) = generate_words_and_pangrams();
    write_palabras_rs(words, pangrams);
}

pub fn generate_words_and_pangrams() -> (HashSet<(String, String)>, HashSet<String>) {
    let elementos = parser::parse_elementos();
    let elementos_by_lema = parser::parse_elementos_by_lema();

    println!("Filtering words and common pangrams...");
    // List of *normalized* common pangrams for puzzle generation
    let mut pangrams: HashSet<String> = HashSet::new();
    // List of all words and their lemma
    let mut words: HashSet<(String, String)> = HashSet::new();

    elementos_by_lema.into_iter().for_each(|(lema, forms)| {
        // Decide if this is a valid word
        let Some((_, elementos_lema, categoria, frec, _, _)) = elementos.get(&lema) else {
            return;
        };
        if lema != *elementos_lema {
            // If this lema is different from the lema returned from elementos, this lema is not
            // what we wanted. E.g. (decid, decid) picks the elemento (decid, decir), and gets
            // included, and pollutes the puzzle data.
            return;
        }
        let (valid, _) = filter(&lema, Some(&lema), Some(*categoria), *frec, true);
        if !valid {
            return;
        }

        // This lema is valid, so add its forms
        forms.iter().for_each(|form| {
            // Ensure this form is valid based on just the word, and check if its a pangram
            let (valid, is_pangram) = filter(form, None, None, usize::MAX, true);
            if !valid {
                return;
            }
            if is_pangram {
                // If this form could be a pangram, grab its frequency to see if its common
                if let Some((_, _, _, frec, _, _)) = elementos.get(form) {
                    let (_, common_pangram) = filter(form, None, None, *frec, true);
                    if common_pangram {
                        pangrams.insert(unidecode::unidecode(form));
                    }
                };
            }

            words.insert((form.clone(), lema.clone()));
        });
    });

    println!(
        "Found {} words and {} common pangrams",
        words.len(),
        pangrams.len()
    );
    (words, pangrams)
}

fn write_palabras_rs(words: HashSet<(String, String)>, pangrams: HashSet<String>) {
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
