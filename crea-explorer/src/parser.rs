use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Copy, Debug, Eq, Deserialize, PartialEq, Serialize)]
pub enum Categoria {
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
pub type ElementoRecord = (String, String, Categoria, usize, f64, f64);

/// Elemento, Categoría, Frecuencia, Frec norm.
pub type FormaRecord = (String, usize, f64);

/// Elemento, Categoría, Frecuencia con signos ort., Frec norm. sin signos ort., Frec. norm
pub type LemaRecord = (String, Categoria, usize, f64, f64);

/// Parse the CREA elementos
pub fn parse_elementos() -> HashMap<String, ElementoRecord> {
    println!("Parsing CREA elementos...");
    let mut elementos: HashMap<String, ElementoRecord> = HashMap::new();
    let mut reader = csv::ReaderBuilder::new()
        .delimiter(b'\t')
        .from_path("crea_elementos.txt")
        .expect("Unable to read crea_elementos.txt");
    reader
        .deserialize::<ElementoRecord>()
        .filter_map(|record| record.ok())
        .for_each(|record| {
            elementos
                .entry(record.0.clone())
                .and_modify(|r| {
                    // If there are multiple instances, update the frequencies
                    // but keep the data of the most frequent (the first one)
                    r.3 += record.3;
                    r.4 += record.4;
                    r.5 += record.5;
                })
                .or_insert(record);
        });
    println!("Found {} elementos", elementos.len());
    elementos
}

/// Parse the CREA elementos into a lema -> \[list of elements\] map
pub fn parse_elementos_by_lema() -> HashMap<String, Vec<String>> {
    println!("Parsing CREA elementos by lema...");
    let mut elementos_by_lema: HashMap<String, Vec<String>> = HashMap::new();
    let mut reader = csv::ReaderBuilder::new()
        .delimiter(b'\t')
        .from_path("crea_elementos.txt")
        .expect("Unable to read crea_elementos.txt");
    reader
        .deserialize::<ElementoRecord>()
        .filter_map(|record| record.ok())
        .for_each(|(word, lema, _, _, _, _)| {
            elementos_by_lema
                .entry(lema)
                .and_modify(|list| {
                    list.push(word.clone());
                })
                .or_insert(vec![word.clone()]);
        });
    println!("Found {} elementos lemas", elementos_by_lema.len());
    elementos_by_lema
}

/// Parse the CREA formas ortograficas
pub fn parse_formas() -> HashMap<String, FormaRecord> {
    println!("Parsing CREA formas ortograficas...");
    let mut formas: HashMap<String, FormaRecord> = HashMap::new();
    let mut reader = csv::ReaderBuilder::new()
        .delimiter(b'\t')
        .from_path("crea_formas_ortograficas.txt")
        .expect("Unable to read crea_formas_ortograficas");
    reader
        .deserialize::<FormaRecord>()
        .filter_map(|record| record.ok())
        .for_each(|record| {
            formas.insert(record.0.clone(), record);
        });
    println!("Found {} formas", formas.len());
    formas
}

/// Parse the CREA lemas
pub fn parse_lemas() -> HashMap<String, LemaRecord> {
    println!("Parsing CREA lemas...");
    let mut lemas: HashMap<String, LemaRecord> = HashMap::new();
    let mut reader = csv::ReaderBuilder::new()
        .delimiter(b'\t')
        .from_path("crea_lemas.txt")
        .expect("Unable to read file");
    reader
        .deserialize::<LemaRecord>()
        .filter_map(|record| record.ok())
        .for_each(|record| {
            lemas
                .entry(record.0.clone())
                .and_modify(|r| {
                    // If there are multiple instances, update the frequencies
                    // but keep the data of the most frequent (the first one)
                    r.2 += record.2;
                    r.3 += record.3;
                    r.4 += record.4;
                })
                .or_insert(record);
        });
    println!("Found {} lemas", lemas.len());
    lemas
}
