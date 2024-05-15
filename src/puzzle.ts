import { invoke } from "@tauri-apps/api/core";
import { Store } from "@tauri-apps/plugin-store";
import _puzzles from "./assets/puzzles.json";
import { DEBUG, type Game } from "./main";
import { isPangram, removeAccents, scoreWord } from "./utils";

const puzzles = _puzzles as unknown as { [key in string]?: Puzzle };

export type WordMap = { [key: string]: string[] };

export interface Puzzle {
	letters: string[];
	words: WordMap;
	lemmas: { [key: string]: string };
	forms: WordMap;
	pangrams: string[];

	maxScore: number;
	word: string;
	found: string[];
	justFound: string[];
	score: number;
}

export type PuzzleData = Pick<
	Puzzle,
	"letters" | "words" | "lemmas" | "forms" | "pangrams"
>;

export interface HintsData {
	pangrams: number;
	lengths: Map<string, number[]>;
	starts: Map<string, number>;
}

export interface SerializableHintsData {
	pangrams: number;
	lengths: [string, number[]][];
	starts: [string, number][];
}

export async function getPuzzle(game: Game, forceNewPuzzle?: "daily" | "new") {
	const today = new Date(Date.now()).toDateString();

	if (forceNewPuzzle == null) {
		const loadedPuzzle = await loadPuzzle(today);
		if (loadedPuzzle != null) {
			const { puzzle, hintsPuzzle, hintsFound } = loadedPuzzle;
			game.puzzle = puzzle;
			game.hintsPuzzle = hintsPuzzle;
			game.hintsFound = hintsFound;
			console.log("Successfully loaded puzzle");
			return;
		}
	}

	console.log("Failed to load puzzle, attempting to create puzzle");

	const puzzle = await createDailyPuzzle(today);
	if (puzzle == null) {
		game.errorText = "Failed to create new daily puzzle";
		return;
	}
	game.puzzle = puzzle;
	[game.hintsPuzzle, game.hintsFound] = getPuzzleHints(game.puzzle);
	game.queenBeeReached = false;

	if (DEBUG.foundAllWords) {
		const words = Object.values(game.puzzle.words).flat();
		for (const word of words) {
			submitWord(game, word, false);
		}
	}

	savePuzzle(game);
}

export async function restartPuzzle(game: Game) {
	game.puzzle.word = "";
	game.puzzle.found = [];
	game.puzzle.score = 0;
	[game.hintsPuzzle, game.hintsFound] = getPuzzleHints(game.puzzle);
	game.queenBeeReached = false;

	if (DEBUG.foundAllWords) {
		const words = Object.values(game.puzzle.words).flat();
		for (const word of words) {
			submitWord(game, word, false);
		}
	}

	savePuzzle(game);
}

export async function savePuzzle(game: Game) {
	if (window.__TAURI__) {
		savePuzzleToStore(game);
	} else {
		savePuzzleToWebStorage(game);
	}
}

export function submitWord(game: Game, word?: string, save = true) {
	if (game.puzzle.word === "") {
		return;
	}

	const enteredWord = removeAccents(word ?? game.puzzle.word.toLowerCase());
	game.puzzle.word = "";

	if (Object.hasOwn(game.puzzle.words, enteredWord)) {
		// The entered word has no accents, i.e. is normalized, so normalize the
		// found words before checking if this word has already been found
		if (game.puzzle.found.map(removeAccents).includes(enteredWord)) {
			game.wordMessage = game.lang.puzzle.alreadyFound;
		} else {
			let count = 0;
			let score = 0;
			game.puzzle.justFound = [];
			for (const word of game.puzzle.words[enteredWord]) {
				game.puzzle.found.unshift(word);
				game.puzzle.justFound.unshift(word);
				score += scoreWord(word, game.puzzle.pangrams);
				count += 1;

				// Hint tracking
				if (isPangram(word, game.puzzle.pangrams)) {
					game.hintsFound.pangrams += 1;
				}
				(game.hintsFound.lengths.get(word[0]) ?? [])[word.length] += 1;
				const start = word.substring(0, 2);
				const numStarts = game.hintsFound.starts.get(start) ?? 0;
				game.hintsFound.starts.set(start, numStarts + 1);
			}
			game.puzzle.score += score;
			game.wordMessage = `+${score}${count > 1 ? ` for ${count}` : ""}`;
			if (save) {
				savePuzzle(game);
			}
		}
	} else if (DEBUG.allowAnyWord) {
		game.puzzle.found.unshift(enteredWord);
		const score = scoreWord(enteredWord, game.puzzle.pangrams);
		game.puzzle.score += score;
		game.wordMessage = `+${score} !`;
		if (save) {
			savePuzzle(game);
		}
	} else {
		if (enteredWord.length < 4) {
			game.wordMessage = game.lang.puzzle.tooShort;
		} else if (
			![...enteredWord].some((l) => l.toUpperCase() === game.puzzle.letters[0])
		) {
			game.wordMessage = game.lang.puzzle.missingCenter;
		} else {
			game.wordMessage = game.lang.puzzle.notInList;
		}
	}
}

async function savePuzzleToStore(game: Game) {
	console.log("Saving puzzle state");
	const store = new Store("store.dat");
	console.debug("To store", game.puzzle);
	await store.set("puzzle", game.puzzle);
	await store.set("hints-puzzle", serializeHints(game.hintsPuzzle));
	await store.set("hints-found", serializeHints(game.hintsFound));
	// Manually save the store now as well (instead of hoping for a graceful exit)
	await store.save();
}

async function savePuzzleToWebStorage(game: Game) {
	console.log("Saving puzzle to web storage");
	window.localStorage.setItem("puzzle", JSON.stringify(game.puzzle));
	window.localStorage.setItem(
		"hints-puzzle",
		JSON.stringify(serializeHints(game.hintsPuzzle)),
	);
	window.localStorage.setItem(
		"hints-found",
		JSON.stringify(serializeHints(game.hintsFound)),
	);
}

function getPuzzleHints(puzzle: Puzzle): [HintsData, HintsData] {
	const hintsPuzzle: HintsData = {
		pangrams: 0,
		lengths: new Map(),
		starts: new Map(),
	};
	const hintsFound: HintsData = {
		pangrams: 0,
		lengths: new Map(),
		starts: new Map(),
	};

	hintsPuzzle.pangrams = puzzle.pangrams.length;

	const words = Object.values(puzzle.words).flat();

	const maxLength = Math.max(...words.map((word) => word.length));
	for (const letter of [...puzzle.letters].sort()) {
		hintsPuzzle.lengths.set(letter.toLowerCase(), Array(maxLength + 1).fill(0));
		hintsFound.lengths.set(letter.toLowerCase(), Array(maxLength + 1).fill(0));
	}

	for (const word of words) {
		(hintsPuzzle.lengths.get(word[0]) ?? [])[word.length] += 1;

		const start = word.substring(0, 2);
		const numStarts = hintsPuzzle.starts.get(start) ?? 0;
		hintsPuzzle.starts.set(start, numStarts + 1);
		hintsFound.starts.set(start, 0);
	}

	return [hintsPuzzle, hintsFound];
}

function serializeHints(hints: HintsData): SerializableHintsData {
	return {
		pangrams: hints.pangrams,
		lengths: Array.from(hints.lengths.entries()),
		starts: Array.from(hints.starts.entries()),
	};
}

function deserializeHints(hints: SerializableHintsData): HintsData {
	return {
		pangrams: hints.pangrams,
		lengths: new Map(hints.lengths),
		starts: new Map(hints.starts),
	};
}

async function loadPuzzleFromStore(day: string): Promise<{
	puzzle: Puzzle;
	hintsPuzzle: HintsData;
	hintsFound: HintsData;
} | null> {
	if (window.__TAURI__ == null) {
		console.error("Unable to load puzzle from Store outside of Tauri");
		return null;
	}
	const store = new Store("store.dat");

	let storedPuzzle: Puzzle | null = null;
	let storedPuzzleDate: string | null = null;
	let storedHintsPuzzle: SerializableHintsData | null = null;
	let storedHintsFound: SerializableHintsData | null = null;

	try {
		console.log("Loading puzzle...");
		storedPuzzle = await store.get<Puzzle>("puzzle");
		storedPuzzleDate = await store.get<string>("puzzle-date");
		storedHintsPuzzle = await store.get<SerializableHintsData>("hints-puzzle");
		storedHintsFound = await store.get<SerializableHintsData>("hints-found");
	} catch (error) {
		console.error("Failed to get stored data:");
		console.error(error);
	}

	// If some piece of the puzzle data is missing or this is not the requested day's puzzle, return null to indicate failure
	if (
		storedPuzzleDate == null ||
		storedPuzzleDate !== day ||
		storedPuzzle == null ||
		storedHintsPuzzle == null ||
		storedHintsFound == null
	) {
		return null;
	}

	console.debug(`Loaded stored puzzle state from ${storedPuzzleDate}`);
	console.debug(storedPuzzle);
	console.log("Stored puzzle is from today, using it");
	return {
		puzzle: storedPuzzle,
		hintsPuzzle: deserializeHints(storedHintsPuzzle),
		hintsFound: deserializeHints(storedHintsFound),
	};
}

async function loadPuzzleFromWebStorage(_day: string): Promise<{
	puzzle: Puzzle;
	hintsPuzzle: HintsData;
	hintsFound: HintsData;
} | null> {
	console.log("Loading puzzle from web storage");
	const storedPuzzle = window.localStorage.getItem("puzzle");
	const storedHintsPuzzle = window.localStorage.getItem("hints-puzzle");
	const storedHintsFound = window.localStorage.getItem("hints-found");

	// If some piece of the stored puzzle is missing, indicate failure
	if (
		storedPuzzle == null ||
		storedHintsPuzzle == null ||
		storedHintsFound == null
	) {
		return null;
	}

	const puzzle = JSON.parse(storedPuzzle) as Puzzle;
	const hintsPuzzle = deserializeHints(JSON.parse(storedHintsPuzzle));
	const hintsFound = deserializeHints(JSON.parse(storedHintsFound));

	return { puzzle, hintsPuzzle, hintsFound };
}

async function loadPuzzle(day: string): Promise<{
	puzzle: Puzzle;
	hintsPuzzle: HintsData;
	hintsFound: HintsData;
} | null> {
	if (window.__TAURI__) {
		return await loadPuzzleFromStore(day);
	}

	return await loadPuzzleFromWebStorage(day);
}

async function createDailyPuzzleFromFile(_day: string): Promise<Puzzle | null> {
	console.log("Getting puzzle from file");
	const today = Math.floor(Date.now() / (1000 * 60 * 60 * 24)).toString();
	console.log(`\tGetting daily puzzle ${today}`);
	const puzzle = puzzles[today];
	if (puzzle == null) {
		console.warn(`Unable to get daily puzzle ${today}`);
		return null;
	}
	console.debug(puzzle);

	return {
		letters: puzzle.letters.map((l) => l.toUpperCase()),
		// TypeScripts inferred type for words is wrong because it is intersection them, which means sometimes the map can have a key whose value is undefined, but this is not the case
		words: puzzle.words,
		lemmas: puzzle.lemmas,
		forms: puzzle.forms,
		pangrams: puzzle.pangrams,
		maxScore: Object.values(puzzle.words)
			.flat()
			.reduce((sum, word) => sum + scoreWord(word, puzzle.pangrams), 0),
		word: "",
		found: [],
		justFound: [],
		score: 0,
	};
}

async function createDailyPuzzleFromTauri(day: string): Promise<Puzzle | null> {
	if (window.__TAURI__ == null) {
		console.error("Unable to create daily puzzle outside of Tauri");
		return null;
	}

	console.log("Creating a new daily puzzle...");
	try {
		const puzzle = (await invoke("daily_puzzle")) as PuzzleData;
		const store = new Store("store.dat");
		await store.set("puzzle-date", day);
		return {
			letters: puzzle.letters.map((l) => l.toUpperCase()),
			words: puzzle.words,
			lemmas: puzzle.lemmas,
			forms: puzzle.forms,
			pangrams: puzzle.pangrams,
			maxScore: Object.values(puzzle.words)
				.flat()
				.reduce((sum, word) => sum + scoreWord(word, puzzle.pangrams), 0),
			word: "",
			found: [],
			justFound: [],
			score: 0,
		};
	} catch (error) {
		console.error("Failed to create daily puzzle:");
		console.error(error);
	}

	return null;
}

async function createDailyPuzzle(day: string): Promise<Puzzle | null> {
	if (window.__TAURI__) {
		return await createDailyPuzzleFromTauri(day);
	}

	return await createDailyPuzzleFromFile(day);
}
