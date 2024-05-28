import { DEBUG, type Game } from "./main";
import { isPangram, removeAccents, scoreWord } from "./utils";
import { dailyPuzzle } from "../puzzle-generator/pkg/";

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
	if (forceNewPuzzle == null) {
		const loadedPuzzle = await loadPuzzle();
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

	// Unset game.puzzle to display loading screen
	game.puzzle.letters = [];

	// Try to create the puzzle
	let puzzle;
	try {
		puzzle = await createDailyPuzzle();
	} catch (error) {
		console.error("Error creating daily puzzle:");
		console.error(error);
	}
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

export function submitWord(game: Game, word?: string, save = true) {
	const enteredWord = removeAccents(word ?? game.puzzle.word.toLowerCase());
	game.puzzle.word = "";
	if (enteredWord === "") {
		return;
	}

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

async function loadPuzzle(): Promise<{
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

async function createDailyPuzzle(day?: number): Promise<Puzzle | null> {
	const puzzleDay = day ?? Math.floor(Date.now() / (1000 * 60 * 60 * 24));
	console.log(`Generating puzzle for day ${puzzleDay} with WASM...`);
	const puzzle = JSON.parse(await dailyPuzzle(puzzleDay)) as PuzzleData;
	console.log(puzzle);
	console.log("Puzzle generated");

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
