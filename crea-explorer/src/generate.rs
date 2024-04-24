use crate::{filter, parser};

pub fn generate() {
    let elementos = parser::parse_elementos();

    println!("Filtering words and common pangrams...");
    let mut pangrams: Vec<String> = vec![];
    let words: Vec<String> = elementos
        .into_values()
        .filter(|(word, lema, categoria, frec, _, _)| {
            let (valid, common_pangram) = filter(word, Some(lema), Some(*categoria), *frec, true);
            if !valid {
                return false;
            }

            if common_pangram {
                pangrams.push(word.to_string());
            }

            true
        })
        .map(|(word, _, _, _, _, _)| word)
        .collect();
    println!(
        "Found {} words and {} common pangrams",
        words.len(),
        pangrams.len()
    );

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
