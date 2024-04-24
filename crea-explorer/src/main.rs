use inquire::{InquireError, Text};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use unidecode::unidecode;

#[derive(Clone, Copy, Debug, Eq, Deserialize, PartialEq, Serialize)]
enum Categoria {
    /// Adjetivo
    A,
    /// Adverbio
    R,
    /// Afijo
    J,
    /// Artículo
    T,
    /// Conjunción
    C,
    /// Contracción
    E,
    /// Cuantificador
    Q,
    /// Demostrativo
    D,
    /// Desconocido
    U,
    /// Extranjerismo
    F,
    /// Interjección
    I,
    /// Interrogativo
    W,
    /// Numeral
    M,
    /// Posesivo
    X,
    /// Preposición
    P,
    /// Pronombre personal
    L,
    /// Puntación
    Y,
    /// Relativo
    H,
    /// Sustantivo
    N,
    /// Verbo
    V,
}

/// Elemento, Lema, Categoría, Frecuencia con signos ort., Frec norm. sin signos ort., Frec. norm
type ElementoRecord = (String, String, Categoria, usize, f64, f64);

/// Elemento, Categoría, Frecuencia, Frec norm.
type FormaRecord = (String, usize, f64);

/// Elemento, Categoría, Frecuencia con signos ort., Frec norm. sin signos ort., Frec. norm
type LemaRecord = (String, Categoria, usize, f64, f64);

fn main() {
    println!("Parsing CREA elementos...");
    let mut elementos: HashMap<String, ElementoRecord> = HashMap::new();
    let mut lemas_reader = csv::ReaderBuilder::new()
        .delimiter(b'\t')
        .from_path("crea_elementos.txt")
        .expect("Unable to read crea_elementos.txt");
    lemas_reader
        .deserialize::<ElementoRecord>()
        .filter_map(|record| record.ok())
        .for_each(|record| {
            elementos.insert(record.0.clone(), record);
        });
    println!("Found {} elementos", elementos.len());

    println!("Parsing CREA formas ortograficas...");
    let mut formas: HashMap<String, FormaRecord> = HashMap::new();
    let mut lemas_reader = csv::ReaderBuilder::new()
        .delimiter(b'\t')
        .from_path("crea_formas_ortograficas.txt")
        .expect("Unable to read crea_formas_ortograficas");
    lemas_reader
        .deserialize::<FormaRecord>()
        .filter_map(|record| record.ok())
        .for_each(|record| {
            formas.insert(record.0.clone(), record);
        });
    println!("Found {} formas", formas.len());

    println!("Parsing CREA lemas...");
    let mut lemas: HashMap<String, LemaRecord> = HashMap::new();
    let mut lemas_reader = csv::ReaderBuilder::new()
        .delimiter(b'\t')
        .from_path("crea_lemas.txt")
        .expect("Unable to read file");
    lemas_reader
        .deserialize::<LemaRecord>()
        .filter_map(|record| record.ok())
        .for_each(|record| {
            lemas.insert(record.0.clone(), record);
        });
    println!("Found {} lemas", lemas.len());

    println!("\nReady for requests");

    loop {
        let response = Text::new("Enter a word:").prompt();
        let Ok(word) = response else {
            match response {
                Err(InquireError::OperationInterrupted) => break,
                Err(InquireError::OperationCanceled) => println!("Use Ctrl-C to exit"),
                _ => {
                    println!("Something went wrong.");
                }
            }
            continue;
        };
        let mut found_something = false;

        if let Some(elemento) = elementos.get(&word) {
            found_something = true;
            println!("Elemento: {:?}", elemento);
            if filter(&elemento.0, Some(elemento.2), elemento.3) {
                println!("\tValid");
            }
        }

        if let Some(forma) = formas.get(&word) {
            found_something = true;
            println!("Forma: {:?}", forma);
            if filter(&forma.0, None, forma.1) {
                println!("\tValid");
            }
        }

        if let Some(lema) = lemas.get(&word) {
            found_something = true;
            println!("Lema: {:?}", lema);
            if filter(&lema.0, Some(lema.1), lema.2) {
                println!("\tValid");
            }
        }

        if !found_something {
            println!("No such element, forma, or lema found");
        }
    }
}

fn filter(word: &String, category: Option<Categoria>, freq: usize) -> bool {
    let mut valid = true;

    // Words must be decently common
    if freq < 50 {
        println!("\tToo infrequent");
        valid = false;
    }

    // No bizzare categories
    if category == Some(Categoria::F) {
        // No foreign words
        println!("\tForeign");
        valid = false;
    } else if category == Some(Categoria::M) {
        // No numerals
        println!("\tNumeral");
        valid = false;
    } else if category == Some(Categoria::Y) {
        // No puntaciones
        println!("\tPunctuation");
        valid = false;
    }

    // Ignore short words
    if word.chars().count() < 4 {
        println!("\tToo short");
        valid = false;
    }

    // Words must be all lowercase letters (no spaces or other funny
    // business)
    let stripped = unidecode(word);
    if !stripped
        .chars()
        .all(|c| c.is_ascii_alphabetic() && c.is_lowercase())
    {
        println!("\tNot only lowercase letters");
        valid = false;
    }

    // No point having more than 7 unique letters
    let uniques = count_unique_chars(&stripped);
    if uniques > 7 {
        println!("\tMore than 7 unique letters");
        valid = false;
    }

    valid
}

fn count_unique_chars(word: &str) -> usize {
    let set: HashSet<char> = HashSet::from_iter(unidecode(word).chars());
    set.len()
}
