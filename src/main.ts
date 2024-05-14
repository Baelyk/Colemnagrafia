import { controls } from "./controls";
import { error, loading, splashScreen } from "./displays";
import { PointerData, gobbleMissedInteractions, listen } from "./listen";
import { menuBar } from "./menu";
import { type HintsData, type Puzzle, getPuzzle } from "./puzzle";
import { scorebar } from "./scorebar";
import { COLORS, resizeCanvas } from "./utils";
import { wheel } from "./wheel";
import { word } from "./word";
import { wordlist } from "./wordlist";

declare global {
	interface Window {
		__TAURI__?: unknown;
	}
}

export const DEBUG = {
	allowAnyWord: false,
	foundAllWords: true,
	eventLogging: false,
};

export function main(time: DOMHighResTimeStamp, game: Game) {
	game.ctx.fillStyle = COLORS.bg(game);
	game.ctx.fillRect(0, 0, game.width, game.height);

	components(time, game);

	gobbleMissedInteractions(game);
}

function components(time: DOMHighResTimeStamp, game: Game) {
	if (game.errorText != null) {
		try {
			error(time, game);
		} catch (error) {
			console.error(`Error during component \`error\``);
			console.error(error);
		}
		return;
	}

	// If there is no puzzle, display a loading message in the splash screen
	if (game.puzzle.letters.length === 0) {
		try {
			loading(time, game);
		} catch (error) {
			console.error(`Error during component \`loading\`: ${error}`);
			console.error(error);
		}
	}

	try {
		const showingSplashScreen = splashScreen(time, game);
		if (showingSplashScreen) {
			return;
		}
	} catch (error) {
		console.error(`Error during component \`splashScreen\`: ${error}`);
		console.error(error);
	}

	try {
		menuBar(time, game);
	} catch (error) {
		console.error(`Error during component \`menuBar\`: ${error}`);
		console.error(error);
	}
	if (game.menuOpen) {
		return;
	}
	if (game.hintsOpen) {
		return;
	}

	try {
		scorebar(time, game);
	} catch (error) {
		console.error(`Error during component \`scorebar\`: ${error}`);
		console.error(error);
	}

	try {
		wordlist(time, game);
	} catch (error) {
		console.error(`Error during component \`wordlist\`: ${error}`);
		console.error(error);
	}
	if (game.wordlistIsOpen) {
		return;
	}

	try {
		const clicked = wheel(time, game);
		game.puzzle.word += clicked;
	} catch (error) {
		console.error(`Error during component \`wheel\`: ${error}`);
		console.error(error);
	}

	try {
		word(time, game);
	} catch (error) {
		console.error(`Error during component \`word\`: ${error}`);
		console.error(error);
	}

	try {
		controls(time, game);
	} catch (error) {
		console.error(`Error during component \`controls\`: ${error}`);
		console.error(error);
	}
}

/**
 * Initialize the Game by setting up the canvas and the Game object.
 */
export function init(): Game {
	console.log("Initializing...");
	const canvas = document.querySelector("canvas");
	if (canvas == null) {
		console.error("Unable to get canvas");
		throw new Error("Unable to get canvas");
	}
	const ctx = canvas.getContext("2d", { alpha: false });
	if (ctx == null) {
		console.error("Unable to get canvas context");
		throw new Error("Unable to get canvas context");
	}

	let darkMode = false;
	if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
		darkMode = true;
	}

	const { scaling, width, height } = resizeCanvas(
		canvas,
		window.innerWidth,
		window.innerHeight,
	);

	const puzzle: Puzzle = {
		letters: [],
		words: {},
		lemmas: {},
		forms: {},
		pangrams: [],
		maxScore: 0,
		word: "",
		found: [],
		justFound: [],
		score: 0,
	};

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

	return {
		width,
		height,
		scaling,
		ctx,
		tagName: "game",
		darkMode,

		errorText: null,
		splashScreenText: null,

		puzzle,
		geniusReached: false,
		queenBeeReached: false,
		revealAnswers: false,

		pointerX: -1,
		pointerY: -1,
		pointerDown: null,
		pointerUp: null,

		clickedHex: null,
		clickedHexTime: null,

		wordMessage: null,

		wordlistIsOpen: false,
		wordlistHeight: 0,
		wordlistScroll: 0,
		wordlistScrollSpeed: 0,
		wordlistUserIsScrolling: false,

		menuOpen: false,

		hintsOpen: false,
		hintsHeight: 0,
		hintsPuzzle,
		hintsFound,
		hintsScroll: 0,
		hintsScrollSpeed: 0,
		hintsUserIsScrolling: false,
		hintsTableScroll: 0,
		hintsTableScrollSpeed: 0,
		hintsTableUserIsScrolling: false,
	};
}

/**
 * The Game data storage object
 */
export interface Game {
	width: number;
	height: number;
	scaling: number;
	ctx: CanvasRenderingContext2D;
	tagName: "game";
	darkMode: boolean;

	errorText: string | null;
	splashScreenText: [string, string] | null;

	puzzle: Puzzle;
	geniusReached: boolean;
	queenBeeReached: boolean;
	revealAnswers: boolean;

	pointerX: number;
	pointerY: number;
	pointerDown: PointerData | null;
	pointerUp: PointerData | null;

	clickedHex: number | null;
	clickedHexTime: DOMHighResTimeStamp | null;

	wordMessage: string | null;

	wordlistIsOpen: boolean;
	wordlistHeight: number;
	wordlistScroll: number;
	wordlistScrollSpeed: number;
	/** Whether the user is currently scrolling (i.e. finger moving the list) */
	wordlistUserIsScrolling: boolean;

	menuOpen: boolean;

	hintsOpen: boolean;
	hintsHeight: number;
	hintsPuzzle: HintsData;
	hintsFound: HintsData;
	hintsScroll: number;
	hintsScrollSpeed: number;
	hintsUserIsScrolling: boolean;
	hintsTableScroll: number;
	hintsTableScrollSpeed: number;
	hintsTableUserIsScrolling: boolean;
}

if (typeof window !== "undefined") {
	window.addEventListener("DOMContentLoaded", async () => {
		const game = init();
		if (game == null) {
			console.error("Error initializing game");
			return;
		}
		// For debugging, log the game
		console.debug(game);

		try {
			await getPuzzle(game);
		} catch (error) {
			console.error("Puzzle generation failed");
			console.debug(error);
			game.errorText = JSON.stringify(error);
		}

		listen(game);

		window.requestAnimationFrame((time) => main(time, game));
	});
}
