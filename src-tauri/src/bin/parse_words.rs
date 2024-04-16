use std::{
    collections::HashSet,
    fs::{self, File},
    io,
};
use unidecode::unidecode;

type Record = (String, String, usize, f64, f64);

fn main() {
    println!("Parsing CREA lemas...");

    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(b'\t')
        .from_path("../crea_lemas.txt")
        .expect("Unable to read file");

    // Extract the valid words
    let mut pangrams: Vec<String> = vec![];
    let words: Vec<String> = rdr
        .deserialize::<Record>()
        //.take(20000)
        .filter_map(|record| record.ok())
        .filter(|(word, category, freq, _, _)| {
            // Words must be decently common
            if *freq < 50 {
                return false;
            }

            // No bizzare categories
            if category == "F" {
                // No foreign words
                return false;
            } else if category == "M" {
                // No numerals
                return false;
            } else if category == "Y" {
                // No puntaciones
                return false;
            }

            // Ignore short words
            if word.chars().count() < 4 {
                return false;
            }

            // Words must be all lowercase letters (no spaces or other funny
            // business)
            let stripped = unidecode(word);
            if !stripped
                .chars()
                .all(|c| c.is_ascii_alphabetic() && c.is_lowercase())
            {
                return false;
            }

            // No point having more than 7 unique letters
            let uniques = count_unique_chars(&stripped);
            if uniques > 7 {
                return false;
            } else if uniques == 7 && *freq > 1000 {
                pangrams.push(word.to_string());
            }

            true
        })
        .map(|(word, _, _, _, _)| word)
        .collect();

    println!(
        "Found {} words and {} potential pangrams",
        words.len(),
        pangrams.len()
    );
    pangrams.iter().take(10).for_each(|word| {
        println!("\t{}", word);
    });

    println!("Writing palabras.txt and pangrams.txt");

    fs::write("../palabras.txt", words.join("\n")).expect("Unable to write palabras.txt");
    fs::write("../pangrams.txt", pangrams.join("\n")).expect("Unable to write pangrams.txt");
}

fn count_unique_chars(word: &str) -> usize {
    let set: HashSet<char> = HashSet::from_iter(unidecode(word).chars());
    set.len()
}
