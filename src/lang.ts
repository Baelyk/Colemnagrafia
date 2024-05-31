import { dateFromDaysSinceEpoch } from "./utils";

export interface Lang {
	title: string;
	error: {
		title: string;
		unknown: string;
	};
	loading: {
		title: string;
		description: string;
	};
	menuBar: {
		date: (day: number) => string;
	};
	menu: {
		restart: string;
		new: string;
		old: string;
		reveal: (revealing: boolean) => string;
		darkMode: (darkModeOn: boolean) => string;
	};
	hints: {
		title: string;
		pangrams: (total: number, found: number) => string;
		remainingWords: string;
		totalAbbreviation: string;
		remainingStarts: string;
		tooltip: (letter: string, count: number) => string;
	};
	score: {
		ranks: [
			string,
			string,
			string,
			string,
			string,
			string,
			string,
			string,
			string,
			string,
		];
		geniusSplashScreen: [string, string];
		queenBeeSplashScreen: [string, string];
	};
	wordlist: {
		foundCount: (count: number) => string;
		lemmaRemaining: (count: number) => string;
	};
	controls: {
		delete: string;
		enter: string;
	};
	puzzle: {
		alreadyFound: string;
		tooShort: string;
		missingCenter: string;
		notInList: string;
	};
	calendar: {
		date: (year: number, monthIndex: number) => string;
		weekday: (weekday: number) => number;
		header: string;
		unplayable: string;
		playable: string;
		today: string;
		started: string;
	};
}

export const en: Lang = {
	title: "Spelling Bee",
	error: {
		title: "Error",
		unknown: "Unknown error",
	},
	loading: {
		title: "Spelling Bee",
		description: "Attempting to load in progress puzzle of create new puzzle",
	},
	menuBar: {
		date: (day: number) => {
			return new Intl.DateTimeFormat("en-US", {
				month: "long",
				day: "numeric",
				year: "numeric",
			}).format(dateFromDaysSinceEpoch(day));
		},
	},
	menu: {
		restart: "Restart",
		new: "Check for new puzzle",
		old: "Play previous puzzle",
		reveal: (revealing: boolean) =>
			revealing ? "Stop revealing answers" : "Reveal answers",
		darkMode: (darkModeOn: boolean) =>
			darkModeOn ? "Light mode" : "Dark mode",
	},
	hints: {
		title: "Hints",
		pangrams: (total: number, found: number) => {
			const remaining = total - found;
			let text = "";
			if (remaining === 0) {
				if (total === 1) {
					text = "You found the pangram! That was the only one.";
				} else {
					text = `You found all the pangrams! There were ${total} in all.`;
				}
			} else {
				if (remaining === 1) {
					text = "There's one more pangram";
				} else {
					text = `There are ${remaining} more pangrams`;
				}
				if (total === 1) {
					text += " and that's the only one.";
				} else {
					text += `, out of ${total} pangrams overall.`;
				}
				if (found === 0) {
					if (total === 1) {
						text += " You haven't found it yet 😞.";
					} else {
						text += " You haven't found any yet 😞.";
					}
				}
			}
			return text;
		},
		remainingWords: "Remaining words",
		totalAbbreviation: "To.",
		remainingStarts: "Remaining starts",
		tooltip: (letter: string, count: number) => {
			return `There ${count === 1 ? "is" : "are"} ${count} more word${
				count === 1 ? "" : "s"
			} that start${count === 1 ? "s" : ""} with ${letter.toUpperCase()}.`;
		},
	},
	score: {
		ranks: [
			"Beginner",
			"Good Start",
			"Moving Up",
			"Good",
			"Solid",
			"Nice",
			"Great",
			"Amazing",
			"Genius",
			"Queen Bee",
		],
		geniusSplashScreen: [
			"Genius 🧠",
			"Look at you go, you're quite the genius bee!",
		],
		queenBeeSplashScreen: [
			"Queen Bee 🐝",
			"You're no simple busy bee, you're the Queen Bee 🐝! Amazing work finding all those words.",
		],
	},
	wordlist: {
		foundCount: (count: number) =>
			`${count} word${count === 1 ? "" : "s"} found`,
		lemmaRemaining: (count: number) =>
			count > 0 ? ` (${count} remaining)` : " (all found)",
	},
	controls: {
		delete: "Delete",
		enter: "Enter",
	},
	puzzle: {
		alreadyFound: "Already Found",
		tooShort: "Too short",
		missingCenter: "Missing center letter",
		notInList: "Not in word list",
	},
	calendar: {
		date: (year: number, monthIndex: number) => {
			return new Intl.DateTimeFormat("en-US", {
				year: "numeric",
				month: "long",
			}).format(new Date(year, monthIndex));
		},
		weekday: (weekday: number) => weekday,
		header: "Select previous daily puzzle",
		unplayable: "Unplayable",
		playable: "Playable",
		today: "Today",
		started: "Started",
	},
};

export const es: Lang = {
	title: "Colemnagrafía",
	error: {
		title: "Error",
		unknown: "Error desconocido",
	},
	loading: {
		title: "Colemnagrafía",
		description: "Intentando cargar o crear un puzle",
	},
	menuBar: {
		date: (day: number) => {
			return new Intl.DateTimeFormat("es-ES", {
				month: "long",
				day: "numeric",
				year: "numeric",
			}).format(dateFromDaysSinceEpoch(day));
		},
	},
	menu: {
		restart: "Reiniciar",
		new: "Buscar un puzle nuevo",
		old: "Jugar un puzle anterior",
		reveal: (revealing: boolean) =>
			revealing ? "Parar de mostrar respuestas" : "Mostrar respuestas",
		darkMode: (darkModeOn: boolean) =>
			darkModeOn ? "Modo claro" : "Modo oscuro",
	},
	hints: {
		title: "Pistas",
		pangrams: (total: number, found: number) => {
			const remaining = total - found;
			let text = "";
			if (remaining === 0) {
				if (total === 1) {
					text = "¡Encontraste la pangrama! Fue la única.";
				} else {
					text = `¡Encontraste todas las pangramas! Había ${total} al fin.`;
				}
			} else {
				if (remaining === 1) {
					text = "Queda una pangrama más";
				} else {
					text = `Quedan ${remaining} otras pangramas más`;
				}
				if (total === 1) {
					text += " y es la única.";
				} else {
					text += `, de ${total} pangramas en total.`;
				}
				if (found === 0) {
					if (total === 1) {
						text += " Todavía no la has encontrado 😞.";
					} else {
						text += " Todavía no has encontrado ninguna 😞.";
					}
				}
			}
			return text;
		},
		remainingWords: "Palabras restantes",
		totalAbbreviation: "To.",
		remainingStarts: "Comienzos restantes",
		tooltip: (letter: string, count: number) => {
			if (count === 1) {
				return `Queda una palabra más que empieza con ${letter.toUpperCase()}`;
			} else {
				return `Quedan ${count} más palabras que empiezan con ${letter.toUpperCase()}`;
			}
		},
	},
	score: {
		ranks: [
			"Novato",
			"Buen comienzo",
			"Subiendo",
			"Que bien",
			"Macizo",
			"Súper",
			"Genial",
			"Increíble",
			"Genio",
			"Abeja Reina",
		],
		geniusSplashScreen: ["Genio 🧠", "Genial, eres una abeja muy intelegente!"],
		queenBeeSplashScreen: [
			"Abeja Reina 🐝",
			"No eres una abeja obrera, eres la abeja reina 🐝! Qué trabajo más maravilloso encontrar todas esas palabras.",
		],
	},
	wordlist: {
		foundCount: (count: number) =>
			`${count} palabra${count === 1 ? "" : "s"} encontrada${
				count === 1 ? "" : "s"
			}`,
		lemmaRemaining: (count: number) =>
			count > 0
				? ` (${count} restante${count === 1 ? "" : ""})`
				: " (todas encontradas)",
	},
	controls: {
		delete: "Eliminar",
		enter: "Enviar",
	},
	puzzle: {
		alreadyFound: "Ya encontrada",
		tooShort: "Demasiado corta",
		missingCenter: "Falta la letra central",
		notInList: "No está en la lista",
	},
	calendar: {
		date: (year: number, monthIndex: number) => {
			return new Intl.DateTimeFormat("es-ES", {
				year: "numeric",
				month: "long",
			}).format(new Date(year, monthIndex));
		},
		weekday: (weekday: number) => (weekday + 6) % 7,
		header: "Elegir un puzle anterior",
		unplayable: "No disponible",
		playable: "Disponible",
		today: "Hoy",
		started: "Empezado",
	},
};
