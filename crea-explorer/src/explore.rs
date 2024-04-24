use crate::{filter, parser};
use inquire::{InquireError, Text};

pub fn explore() {
    let elementos = parser::parse_elementos();
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
