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
	day: number;

	maxScore: number;
	word: string;
	found: string[];
	justFound: string[];
	score: number;
}

export type PuzzleData = Pick<
	Puzzle,
	"letters" | "words" | "lemmas" | "forms" | "pangrams" | "day"
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

export async function getPuzzle(game: Game, day?: number) {
	const today = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
	if (day == null) {
		// If the day is not specified use the URL parameter, or default to today
		const params = new URLSearchParams(window.location.search);
		day = Number(params.get("day") ?? undefined);
		// The day is bad if it is NaN, negative, or a future day
		if (Number.isNaN(day) || day < 0 || day > today) {
			if (params.has("day")) {
				console.log(`Ignoring bad day ${day} from ${params.get("day")}`);
			}
			// Missing or bad URL parameter, default to today
			day = today;
		}
	}
	console.log(`Getting puzzle for day ${day} (today is ${today})`);

	// Try to load the puzzle
	const loadedPuzzle = await loadPuzzle(day);
	if (loadedPuzzle != null) {
		const { puzzle, hintsPuzzle, hintsFound } = loadedPuzzle;
		game.puzzle = puzzle;
		game.hintsPuzzle = hintsPuzzle;
		game.hintsFound = hintsFound;
		console.log("\tSuccessfully loaded puzzle");
		return;
	}

	// Loading failed, generate the puzzle instead
	console.log("\tFailed to load puzzle, attempting to create puzzle");

	// Unset game.puzzle to display loading screen
	game.puzzle.letters = [];

	// Try to create the puzzle
	let puzzle;
	try {
		puzzle = await createDailyPuzzle(day);
	} catch (error) {
		console.error("Error creating daily puzzle:");
		console.error(error);
	}
	if (puzzle == null) {
		game.errorText = "Failed to create new puzzle";
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

async function loadPuzzle(day: number): Promise<{
	puzzle: Puzzle;
	hintsPuzzle: HintsData;
	hintsFound: HintsData;
} | null> {
	console.log(`\tLoading puzzle for day ${day} from web storage`);
	const storedPuzzle = window.localStorage.getItem(`${day}-puzzle`);
	const storedHintsPuzzle = window.localStorage.getItem(`${day}-hints-puzzle`);
	const storedHintsFound = window.localStorage.getItem(`${day}-hints-found`);

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

async function createDailyPuzzle(day: number): Promise<Puzzle | null> {
	console.log(`\tGenerating puzzle for day ${day} with WASM...`);
	const puzzle = JSON.parse(await dailyPuzzle(day)) as PuzzleData;
	console.log(puzzle);
	console.log("\tPuzzle generated");

	return {
		letters: puzzle.letters.map((l) => l.toUpperCase()),
		// TypeScripts inferred type for words is wrong because it is intersection them, which means sometimes the map can have a key whose value is undefined, but this is not the case
		words: puzzle.words,
		lemmas: puzzle.lemmas,
		forms: puzzle.forms,
		pangrams: puzzle.pangrams,
		day: puzzle.day,
		maxScore: Object.values(puzzle.words)
			.flat()
			.reduce((sum, word) => sum + scoreWord(word, puzzle.pangrams), 0),
		word: "",
		found: [],
		justFound: [],
		score: 0,
	};
}

export async function savePuzzle(game: Game) {
	console.log("Saving puzzle to web storage");
	const day = game.puzzle.day;
	window.localStorage.setItem(`${day}-puzzle`, JSON.stringify(game.puzzle));
	window.localStorage.setItem(
		`${day}-hints-puzzle`,
		JSON.stringify(serializeHints(game.hintsPuzzle)),
	);
	window.localStorage.setItem(
		`${day}-hints-found`,
		JSON.stringify(serializeHints(game.hintsFound)),
	);
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
			game.wordMessage = `+ ${score}${count > 1 ? ` for ${count}` : ""} `;
			if (save) {
				savePuzzle(game);
			}
		}
	} else if (DEBUG.allowAnyWord) {
		game.puzzle.found.unshift(enteredWord);
		const score = scoreWord(enteredWord, game.puzzle.pangrams);
		game.puzzle.score += score;
		game.wordMessage = `+ ${score} !`;
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
