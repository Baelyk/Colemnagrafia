use std::collections::HashSet;

use crate::{filter, parser};
use inquire::{InquireError, Text};

pub fn explore() {
    let elementos = parser::parse_elementos();
    let elementos_by_lema = parser::parse_elementos_by_lema();
    let formas = parser::parse_formas();
    let lemas = parser::parse_lemas();

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
            if filter(
                &elemento.0,
                Some(&elemento.1),
                Some(elemento.2),
                elemento.3,
                false,
            )
            .0
            {
                println!("\tValid");
            }
            if let Some(elementos_with_this_lema) = elementos_by_lema.get(&elemento.1) {
                let validateds: HashSet<&String> = elementos_with_this_lema
                    .iter()
                    .filter(|word| crate::filter(word, None, None, usize::MAX, true).0)
                    .collect();
                if elemento.0 == elemento.1 {
                    print!("Elementos by lema: ({}) ", validateds.len());
                    validateds.iter().for_each(|word| print!("{}, ", word));
                    println!("");
                } else if validateds.contains(&elemento.0) {
                    if let Some(origin) = elementos.get(&elemento.1) {
                        println!("Elementos by lema: {} from {:?}", elemento.0, origin);
                        println!("\tValid");
                    }
                }
            }
        }

        if let Some(forma) = formas.get(&word) {
            found_something = true;
            println!("Forma: {:?}", forma);
            if filter(&forma.0, None, None, forma.1, false).0 {
                println!("\tValid");
            }
        }

        if let Some(lema) = lemas.get(&word) {
            found_something = true;
            println!("Lema: {:?}", lema);
            if filter(&lema.0, None, Some(lema.1), lema.2, false).0 {
                println!("\tValid");
            }
        }

        if !found_something {
            println!("No such element, forma, or lema found");
        }
    }
}
