use clap::{Parser, Subcommand};
use parser::Categoria;
use std::collections::HashSet;
use unidecode::unidecode;

mod explore;
mod frequency;
mod generate;
mod parser;

/// Program to explore the RAE's CREA and generate the wordlists for the game
#[derive(Parser, Debug)]
struct Args {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Explore the CREA files
    Explore,
    /// Generate palabras.rs
    Generate,
    /// View words omitted by a minimum frequency
    Frequency {
        /// Minimum frequency
        freq: usize,
        /// Number of words to display
        #[arg(default_value_t = 10)]
        words: usize,
    },
}

fn main() {
    let args = Args::parse();

    match args.command {
        Command::Explore => explore::explore(),
        Command::Generate => generate::generate(),
        Command::Frequency { freq, words } => frequency::frequency(freq, words),
    }
}

pub fn filter(
    word: &String,
    lema: Option<&String>,
    category: Option<Categoria>,
    freq: usize,
    short_circuit: bool,
) -> (bool, bool) {
    const ONLY_ACCEPT_INFINITIVES: bool = false;

    let mut valid = true;
    let mut common_pangram = false;

    // Words must be decently common
    if freq < 50 {
        if short_circuit {
            return (false, common_pangram);
        };
        println!("\tToo infrequent");
        valid = false;
    }

    // No bizzare categories
    if category == Some(Categoria::F) {
        // No foreign words
        if short_circuit {
            return (false, common_pangram);
        };
        println!("\tForeign");
        valid = false;
    } else if category == Some(Categoria::M) {
        // No numerals
        if short_circuit {
            return (false, common_pangram);
        };
        println!("\tNumeral");
        valid = false;
    } else if category == Some(Categoria::Y) {
        // No puntaciones
        if short_circuit {
            return (false, common_pangram);
        };
        println!("\tPunctuation");
        valid = false;
    }

    // Only take verbs in the infinitive
    if ONLY_ACCEPT_INFINITIVES && category == Some(Categoria::V) {
        // Infinitives should be the same as their lema
        if Some(word) != lema {
            if short_circuit {
                return (false, common_pangram);
            };
            println!("\tVerb not an infinitive");
            valid = false;
        }
    }

    // Ignore short words
    if word.chars().count() < 4 {
        if short_circuit {
            return (false, common_pangram);
        };
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
        if short_circuit {
            return (false, common_pangram);
        };
        println!("\tNot only lowercase letters");
        valid = false;
    }

    // No point having more than 7 unique letters
    let uniques = count_unique_chars(&stripped);
    if uniques > 7 {
        if short_circuit {
            return (false, common_pangram);
        };
        println!("\tMore than 7 unique letters");
        valid = false;
    } else if uniques == 7 && freq > 1000 {
        common_pangram = true;
        if !short_circuit {
            println!("\tIs a common pangram");
        }
    }

    (valid, common_pangram)
}

fn count_unique_chars(word: &str) -> usize {
    let set: HashSet<char> = HashSet::from_iter(unidecode(word).chars());
    set.len()
}
