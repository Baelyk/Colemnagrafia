import { invoke } from "@tauri-apps/api/core";
import { Store } from '@tauri-apps/plugin-store';
import _puzzles from "./assets/puzzles.json";
const puzzles = _puzzles as unknown as { [key in string]?: Puzzle };

declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

const DEBUG = {
  allowAnyWord: false,
  foundAllWords: false,
  eventLogging: false,
}

interface HasDarkMode {
  darkMode: boolean;
}
const COLORS = {
  fg: ({ darkMode }: HasDarkMode) => darkMode ? "white" : "black",
  bg: ({ darkMode }: HasDarkMode) => darkMode ? "black" : "white",
  yellow: ({ darkMode }: HasDarkMode) => darkMode ? "goldenrod" : "gold",
  darkyellow: ({ darkMode }: HasDarkMode) => darkMode ? "gold" : "goldenrod",
  gray: ({ darkMode }: HasDarkMode) => darkMode ? "gray" : "lightgray",
  darkgray: ({ darkMode }: HasDarkMode) => darkMode ? "darkgray" : "darkgray",
  red: ({ darkMode }: HasDarkMode) => darkMode ? "red" : "red",
};

const FONTS = {
  default: "sans-serif",
  word: "JetBrains Mono, sans-serif",
}

interface HasSize {
  width: number;
  height: number;
}
const SIZES = {
  smallestDimension: (size: HasSize) => {
    if (size.height / size.width <= 1.75) {
      return size.height / 1.75;
    }
    return Math.min(size.width, size.height);
  },
  big: (size: HasSize) => SIZES.smallestDimension(size) / 7,
  medium: (size: HasSize) => SIZES.smallestDimension(size) / 10,
  small: (size: HasSize) => SIZES.smallestDimension(size) / 15,
  tiny: (size: HasSize) => SIZES.smallestDimension(size) / 25,
  teeny: (size: HasSize) => SIZES.smallestDimension(size) / 90,
}

type WordMap = { [key: string]: string[] };


interface Game {
  width: number;
  height: number;
  scaling: number;
  ctx: CanvasRenderingContext2D;
  tagName: "game";
  darkMode: boolean;

  errorText: string | null;

  puzzle: Puzzle;
  revealAnswers: boolean;

  mouseX: number;
  mouseY: number;
  mouseDown: boolean;

  clickedHex: number | null;
  clickedHexTime: DOMHighResTimeStamp | null;

  wordMessage: string | null;

  wordlistIsOpen: boolean;
  wordlistScroll: number;
  wordlistScrollSpeed: number;
  /** Whether the user is currently scrolling (i.e. finger moving the list) */
  wordlistUserIsScrolling: boolean;

  menuOpen: boolean;

  hintsOpen: boolean;
  hintsHeight: number;
  hintsPuzzle: HintsData,
  hintsFound: HintsData,
  hintsScroll: number;
  hintsScrollSpeed: number;
  hintsUserIsScrolling: boolean;
  hintsTableScroll: number;
  hintsTableScrollSpeed: number;
  hintsTableUserIsScrolling: boolean;
}

interface Puzzle {
  letters: string[];
  words: WordMap;
  pangrams: string[];
  maxScore: number;
  word: string;
  found: string[];
  score: number;
}

type PuzzleData = Pick<Puzzle, "letters" | "words" | "pangrams">;

interface HintsData {
  pangrams: number;
  lengths: Map<string, number[]>;
  starts: Map<string, number>;
}

interface SerializableHintsData {
  pangrams: number;
  lengths: [string, number[]][];
  starts: [string, number][];
}

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

  window.addEventListener("pointerdown", (event) => {
    if (DEBUG.eventLogging) console.log("pointerdown");
    game.mouseX = event.clientX * game.scaling;
    game.mouseY = event.clientY * game.scaling;
    game.mouseDown = true;
    game.wordMessage = null;

    if (game.wordlistIsOpen) {
      game.wordlistUserIsScrolling = true;
    }
    if (game.hintsOpen) {
      game.hintsUserIsScrolling = true;
      game.hintsTableUserIsScrolling = true;
    }

    window.requestAnimationFrame((time) => main(time, game));
  });

  window.addEventListener("resize", () => {
    if (DEBUG.eventLogging) console.log("resize");
    resizeCanvas(game, window.innerWidth, window.innerHeight);

    window.requestAnimationFrame((time) => main(time, game));
  });

  window.addEventListener("wheel", (event) => {
    if (DEBUG.eventLogging) console.log("wheel");
    if (game.wordlistIsOpen) {
      game.wordlistScroll += event.deltaY;
    }
    if (game.hintsOpen) {
      game.hintsScroll += event.deltaY;
      game.hintsTableScroll += event.deltaX;
    }

    window.requestAnimationFrame((time) => main(time, game));
  });

  window.addEventListener("pointermove", (event) => {
    if (DEBUG.eventLogging) console.log("pointermove");

    // Update the game's mouseX and Y
    game.mouseX = event.clientX * game.scaling;
    game.mouseY = event.clientY * game.scaling;
    // If the pointer is moving, its not down
    game.mouseDown = false;
    window.requestAnimationFrame((time) => main(time, game));

    if (event.pointerType === "mouse") {
      // Now, return if the mouse button is not down
      if (event.pressure < 0.5) {
        return;
      }
    }

    // Handle scrolling
    if (game.wordlistIsOpen) {
      game.wordlistScroll -= event.movementY;
      game.wordlistScrollSpeed = event.movementY;
      game.wordlistUserIsScrolling = true;
    }
    if (game.hintsOpen) {
      if (game.hintsTableUserIsScrolling) {
        if (Math.abs(event.movementY) - Math.abs(event.movementX) > 2) {
          // User is scrolling in the table, but y-scrolling is greater than
          // x-scrolling, so only scroll the hints page
          game.hintsTableUserIsScrolling = false;
        } else {
          // User is scrolling in the table
          game.hintsUserIsScrolling = false;
        }
      } else {
        game.hintsUserIsScrolling = true;
      }

      if (game.hintsUserIsScrolling) {
        game.hintsScroll -= event.movementY;
        game.hintsScrollSpeed = event.movementY;
        game.hintsUserIsScrolling = true;
      }
      if (game.hintsTableUserIsScrolling) {
        game.hintsTableScroll -= event.movementX;
        game.hintsTableScrollSpeed = event.movementX;
        game.hintsTableUserIsScrolling = true;
      }
    }
  });

  window.addEventListener("pointerup", (_event) => {
    if (DEBUG.eventLogging) console.log("pointerup");

    if (game.wordlistIsOpen) {
      game.wordlistUserIsScrolling = false;
      // If the wordlist is open and the user has lifted the pointer (anywhere), close the wordlist
      if (game.mouseDown) {
        game.mouseDown = false;
        game.wordlistIsOpen = false;
      }
    }
    if (game.hintsOpen) {
      game.hintsUserIsScrolling = false;
      game.hintsTableUserIsScrolling = false;
    }

    window.requestAnimationFrame((time) => main(time, game));
  });

  window.addEventListener("keyup", (event) => {
    if (DEBUG.eventLogging) console.log("keyup");

    game.wordMessage = null;

    const key = event.key.toUpperCase();
    if (game.puzzle.letters.includes(key)) {
      game.puzzle.word += key;
      window.requestAnimationFrame((time) => main(time, game));
    } else if (key === "ENTER") {
      submitWord(game);
      window.requestAnimationFrame((time) => main(time, game));
    } else if (key === "BACKSPACE") {
      game.puzzle.word = game.puzzle.word.substring(0, game.puzzle.word.length - 1);
      window.requestAnimationFrame((time) => main(time, game));
    } else if (key === " ") {
      // Shuffle on space
      game.puzzle.letters = game.puzzle.letters
        .map((letter, i) => ({ letter, sort: i === 0 ? 0 : Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ letter }) => letter);
      window.requestAnimationFrame((time) => main(time, game));
    }
  });

  // Listen for dark mode preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    if (DEBUG.eventLogging) console.log("prefers-color-scheme");
    game.darkMode = event.matches;
    document.documentElement.style.removeProperty("background-color");

    window.requestAnimationFrame((time) => main(time, game));
  });

  window.requestAnimationFrame((time) => main(time, game));
});

function resizeCanvas(gameOrCanvas: Game | HTMLCanvasElement, width: number, height: number): { scaling: number, width: number, height: number } {
  const scaling = window.devicePixelRatio;

  if (gameOrCanvas.tagName === "game") {
    const game = gameOrCanvas as Game;

    game.width = width;
    game.height = height;
    game.scaling = scaling;

    game.ctx.canvas.style.width = `${width}px`;
    game.ctx.canvas.style.height = `${height}px`;
    game.ctx.canvas.width = width * scaling;
    game.ctx.canvas.height = height * scaling;

    game.ctx.scale(scaling, scaling);
  } else {
    const canvas = gameOrCanvas as HTMLCanvasElement;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width * scaling;
    canvas.height = height * scaling;

    const ctx = canvas.getContext("2d");
    if (ctx == null) {
      throw new Error("Unable to get canvas context");
    }
    ctx.scale(scaling, scaling);
  }

  return {
    scaling,
    width,
    height
  }
}

function init(): Game {
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
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    darkMode = true;
  }

  const { scaling, width, height } = resizeCanvas(canvas, window.innerWidth, window.innerHeight);

  const puzzle: Puzzle = {
    letters: [],
    words: {},
    pangrams: [],
    maxScore: 0,
    word: "",
    found: [],
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

    puzzle,
    revealAnswers: false,

    mouseX: -1,
    mouseY: -1,
    mouseDown: false,

    clickedHex: null,
    clickedHexTime: null,

    wordMessage: null,

    wordlistIsOpen: false,
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

async function savePuzzleToStore(game: Game) {
  console.log("Saving puzzle state");
  const store = new Store("store.dat");
  await store.set("puzzle", game.puzzle);
  await store.set("hints-puzzle", serializeHints(game.hintsPuzzle));
  await store.set("hints-found", serializeHints(game.hintsFound));
  // Manually save the store now as well (instead of hoping for a graceful exit)
  await store.save();
}

async function savePuzzleToWebStorage(game: Game) {
  console.log("Saving puzzle to web storage");
  window.localStorage.setItem("puzzle", JSON.stringify(game.puzzle));
  window.localStorage.setItem("hints-puzzle", JSON.stringify(serializeHints(game.hintsPuzzle)));
  window.localStorage.setItem("hints-found", JSON.stringify(serializeHints(game.hintsFound)));
}

async function savePuzzle(game: Game) {
  if (window.__TAURI__) {
    savePuzzleToStore(game);
  } else {
    savePuzzleToWebStorage(game);
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

  const maxLength = Math.max(...Object.keys(puzzle.words).map((word) => word.length));
  for (const letter of [...puzzle.letters].sort()) {
    hintsPuzzle.lengths.set(letter.toLowerCase(), Array(maxLength + 1).fill(0));
    hintsFound.lengths.set(letter.toLowerCase(), Array(maxLength + 1).fill(0));
  }

  for (const word of Object.values(puzzle.words).flat()) {
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
  }
}

function deserializeHints(hints: SerializableHintsData): HintsData {
  return {
    pangrams: hints.pangrams,
    lengths: new Map(hints.lengths),
    starts: new Map(hints.starts),
  }
}

async function loadPuzzleFromStore(day: string): Promise<{ puzzle: Puzzle, hintsPuzzle: HintsData, hintsFound: HintsData } | null> {
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
  if (storedPuzzleDate == null || storedPuzzleDate !== day || storedPuzzle == null || storedHintsPuzzle == null || storedHintsFound == null) {
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

async function loadPuzzleFromWebStorage(_day: string): Promise<{ puzzle: Puzzle, hintsPuzzle: HintsData, hintsFound: HintsData } | null> {
  console.log("Loading puzzle from web storage");
  const storedPuzzle = window.localStorage.getItem("puzzle");
  const storedHintsPuzzle = window.localStorage.getItem("hints-puzzle");
  const storedHintsFound = window.localStorage.getItem("hints-found");

  // If some piece of the stored puzzle is missing, indicate failure
  if (storedPuzzle == null || storedHintsPuzzle == null || storedHintsFound == null) {
    return null;
  }

  const puzzle = JSON.parse(storedPuzzle) as Puzzle;
  const hintsPuzzle = deserializeHints(JSON.parse(storedHintsPuzzle));
  const hintsFound = deserializeHints(JSON.parse(storedHintsFound));

  return { puzzle, hintsPuzzle, hintsFound };
}


async function loadPuzzle(day: string): Promise<{ puzzle: Puzzle, hintsPuzzle: HintsData, hintsFound: HintsData } | null> {
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
    letters: puzzle.letters.map(l => l.toUpperCase()),
    // TypeScripts inferred type for words is wrong because it is intersection them, which means sometimes the map can have a key whose value is undefined, but this is not the case
    words: puzzle.words as unknown as WordMap,
    pangrams: puzzle.pangrams,
    maxScore: Object.values(puzzle.words).flat().reduce(
      (sum, word) => sum + scoreWord(word, puzzle.pangrams), 0),
    word: "",
    found: [],
    score: 0,
  }
}

async function createDailyPuzzleFromTauri(day: string): Promise<Puzzle | null> {
  if (window.__TAURI__ == null) {
    console.error("Unable to create daily puzzle outside of Tauri");
    return null;
  }

  console.log("Creating a new daily puzzle...");
  try {
    const puzzle = await invoke("daily_puzzle") as PuzzleData;
    const store = new Store("store.dat");
    await store.set("puzzle-date", day);
    return {
      letters: puzzle.letters.map(l => l.toUpperCase()),
      words: puzzle.words,
      pangrams: puzzle.pangrams,
      maxScore: Object.values(puzzle.words).flat().reduce(
        (sum, word) => sum + scoreWord(word, puzzle.pangrams), 0),
      word: "",
      found: [],
      score: 0,
    }

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

async function getPuzzle(game: Game, forceNewPuzzle?: "daily" | "new") {
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
  console.log(game.hintsPuzzle);

  if (DEBUG.foundAllWords) {
    for (const word of Object.values(game.puzzle.words).flat()) {
      submitWord(game, word);
    }
  }

  savePuzzle(game);
}

async function restartPuzzle(game: Game) {
  game.puzzle.word = "";
  game.puzzle.found = [];
  game.puzzle.score = 0;
  [, game.hintsFound] = getPuzzleHints(game.puzzle);

  if (DEBUG.foundAllWords) {
    for (const word of Object.values(game.puzzle.words).flat()) {
      submitWord(game, word);
    }
  }
  savePuzzle(game);
}

function main(time: DOMHighResTimeStamp, game: Game) {
  game.ctx.fillStyle = COLORS.bg(game);
  game.ctx.fillRect(0, 0, game.width, game.height);

  if (game.errorText != null) {
    error(time, game);
    return;
  }

  if (game.puzzle.letters.length === 0) {
    loading(time, game);
    return;
  }

  menuBar(time, game);
  if (game.menuOpen) {
    return;
  }
  if (game.hintsOpen) {
    return;
  }

  const clicked = wheel(time, game);
  game.puzzle.word += clicked;

  word(time, game);

  controls(time, game);

  scorebar(time, game);

  wordlist(time, game);
}

function error(_time: DOMHighResTimeStamp, game: Game) {
  console.log("Error");

  game.ctx.font = `bold ${SIZES.big(game)}px ${FONTS.default}`;
  game.ctx.textAlign = "left";
  game.ctx.textBaseline = "middle";
  game.ctx.fillStyle = COLORS.fg(game);

  game.ctx.fillText("Error", SIZES.small(game), SIZES.small(game));
  game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
  game.ctx.fillText(game.errorText || "Unknown error", SIZES.small(game), 2 * SIZES.small(game) + SIZES.big(game));
}

function loading(time: DOMHighResTimeStamp, game: Game) {
  console.log("Loading...");
  window.requestAnimationFrame((time) => main(time, game));

  game.ctx.font = `bold ${SIZES.big(game)}px ${FONTS.default}`;
  game.ctx.textAlign = "left";
  game.ctx.textBaseline = "middle";

  const dots = ".".repeat((time / 250) % 4);
  game.ctx.fillText(`Loading${dots}`, game.width / 2 - game.ctx.measureText("Loading...").width / 2, game.height / 2);
}

function menuBar(time: DOMHighResTimeStamp, game: Game) {
  const menuBarY = SIZES.tiny(game);
  const menuBarPadding = SIZES.tiny(game);

  const menuWidth = SIZES.small(game);
  const menuX = game.width - menuWidth - menuBarPadding;
  const menuHamburgerHeight = SIZES.teeny(game) / 2;
  const menuHeight = 3 * 4 * menuHamburgerHeight;
  menu(time, game, menuBarY, menuWidth, menuX, menuHamburgerHeight, menuHeight);
  if (game.menuOpen) {
    return;
  }

  hints(time, game, menuBarY, menuBarPadding, menuHeight, menuX);
  if (game.hintsOpen) {
    return;
  }
}

function menu(_time: DOMHighResTimeStamp, game: Game, menuY: number, menuWidth: number, menuX: number, menuHamburgerHeight: number, menuHeight: number) {
  if (!game.menuOpen) {
    game.ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      game.ctx.roundRect(menuX, menuY + menuHamburgerHeight * 1.5 + 4 * i * menuHamburgerHeight, menuWidth, menuHamburgerHeight, SIZES.tiny(game));
    }
    game.ctx.fillStyle = COLORS.fg(game);
    game.ctx.fill();

    // Detect interaction
    game.ctx.beginPath();
    game.ctx.rect(menuX, menuY, menuWidth, menuHeight);
    if (game.mouseDown && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
      game.mouseDown = false;
      game.menuOpen = true;

      window.requestAnimationFrame((time) => main(time, game));
    }

  }

  if (game.menuOpen) {
    const menuButtonWidth = game.width - 2 * SIZES.small(game);
    const menuX = (game.width - menuButtonWidth) / 2;

    game.ctx.font = `${SIZES.small(game)}px ${FONTS.default}`
    game.ctx.textAlign = "left";
    game.ctx.textBaseline = "middle";
    const menuButtonHeight = getTextHeight(game.ctx, "A") + SIZES.small(game);
    const menuRowHeight = menuButtonHeight + SIZES.small(game);

    const menuOptions: [string, () => void][] = [
      ["Restart", () => {
        restartPuzzle(game);
        game.menuOpen = false;

        window.requestAnimationFrame((time) => main(time, game));
      }],
      ["Check for new puzzle", () => {
        getPuzzle(game, "daily");
        game.menuOpen = false;

        window.requestAnimationFrame((time) => main(time, game));
      }],
      [game.revealAnswers ? "Stop revealing answers" : "Reveal answers", () => {
        game.revealAnswers = !game.revealAnswers;
        if (game.revealAnswers) {
          game.wordlistIsOpen = true;
        }
        game.menuOpen = false;

        window.requestAnimationFrame((time) => main(time, game));
      }],
      [`${game.darkMode ? "Light" : "Dark"} mode`, () => {
        game.darkMode = !game.darkMode;
        game.menuOpen = false;

        document.documentElement.style.setProperty("background-color", COLORS.bg(game));

        window.requestAnimationFrame((time) => main(time, game));
      }]
    ];

    const menuY = game.height / 2 - menuOptions.length * menuRowHeight / 2;

    menuOptions.forEach(([menuOptionText, menuOptionAction], i) => {
      game.ctx.beginPath();
      game.ctx.roundRect(menuX, menuY + menuRowHeight * i, menuButtonWidth, menuButtonHeight, SIZES.teeny(game));
      if (game.mouseDown && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
        game.mouseDown = false;

        menuOptionAction();

        game.ctx.fillStyle = COLORS.darkgray(game);
        window.requestAnimationFrame((time) => main(time, game));
      } else {
        game.ctx.fillStyle = COLORS.bg(game);
      }
      game.ctx.fill();
      game.ctx.strokeStyle = COLORS.fg(game);
      game.ctx.stroke();

      game.ctx.fillStyle = COLORS.fg(game);
      game.ctx.fillText(menuOptionText, menuX + SIZES.small(game), menuY + menuButtonHeight / 2 + (menuRowHeight) * i);
    });

    // Any interaction not on a menu option closes the menu
    if (game.mouseDown) {
      game.mouseDown = false;
      game.menuOpen = false;

      window.requestAnimationFrame((time) => main(time, game));
    }
  }
}

function hints(_time: DOMHighResTimeStamp, game: Game, menuBarY: number, menuBarPadding: number, menuHeight: number, menuX: number) {
  const hintsX = menuX - menuBarPadding - menuHeight;
  const hintsY = menuBarY;
  game.ctx.beginPath();
  game.ctx.roundRect(hintsX, hintsY, menuHeight, menuHeight, SIZES.teeny(game));
  game.ctx.strokeStyle = COLORS.fg(game);
  if (game.hintsOpen) {
    game.ctx.lineWidth = 2;
    game.ctx.fillStyle = COLORS.yellow(game);
  } else {
    game.ctx.lineWidth = 1;
    game.ctx.fillStyle = COLORS.bg(game);
  }
  game.ctx.fill();
  game.ctx.stroke();

  // Detect interaction
  if (game.mouseDown && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    game.mouseDown = false;
    game.hintsOpen = !game.hintsOpen;

    window.requestAnimationFrame((time) => main(time, game));
  }

  game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.word}`
  game.ctx.textAlign = "center";
  game.ctx.textBaseline = "middle";
  game.ctx.fillStyle = COLORS.fg(game);
  game.ctx.fillText("?", hintsX + menuHeight / 2, hintsY + menuHeight / 2);

  if (game.hintsOpen) {
    let hintsY = SIZES.teeny(game);

    game.ctx.fillStyle = COLORS.fg(game);
    game.ctx.textAlign = "left";
    game.ctx.textBaseline = "top";
    const hintsHeader = "hints";
    game.ctx.font = `bold ${SIZES.medium(game)}px ${FONTS.word}`
    game.ctx.fillText("Hints", menuBarPadding, hintsY);
    hintsY += getTextHeight(game.ctx, hintsHeader);

    // Clip to only display text inside the wordlist
    game.ctx.beginPath();
    game.ctx.rect(0, hintsY, game.width, game.height);
    game.ctx.save();
    game.ctx.clip();

    hintsY += SIZES.small(game);

    const hintsMaxScroll = Math.max(0, game.hintsHeight - game.height);
    [game.hintsScroll, game.hintsScrollSpeed] = scrolling(game, game.hintsScroll, game.hintsScrollSpeed, game.hintsUserIsScrolling, hintsMaxScroll);
    hintsY -= game.hintsScroll;

    const remainingPangrams = game.hintsPuzzle.pangrams - game.hintsFound.pangrams;
    let hintsPangramText = "";
    if (remainingPangrams === 0) {
      if (game.hintsPuzzle.pangrams === 1) {
        hintsPangramText = "You found the pangram! That was the only one.";
      } else {
        hintsPangramText = `You found all the pangrams! There were ${game.hintsPuzzle.pangrams} in all.`;
      }
    } else {
      if (remainingPangrams === 1) {
        hintsPangramText = "There's one more pangram";
      } else {
        hintsPangramText = `There are ${remainingPangrams} more pangrams`;
      }
      if (game.hintsPuzzle.pangrams === 1) {
        hintsPangramText += " and that's the only one."
      } else {
        hintsPangramText += `, out of ${game.hintsPuzzle.pangrams} pangrams overall.`;
      }
      if (game.hintsFound.pangrams === 0) {
        hintsPangramText += " You haven't found any yet 😞.";
      }
    }
    game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`
    const hintsPangramTextHeight = wrapText(game.ctx, hintsPangramText, menuBarPadding, hintsY, game.width - menuBarPadding * 2);
    hintsY += hintsPangramTextHeight + SIZES.small(game);

    const cellSize = SIZES.medium(game);

    game.ctx.fillStyle = COLORS.fg(game);
    game.ctx.textAlign = "left";
    game.ctx.textBaseline = "top";
    const remainingWordsHeader = "Remaining words";
    game.ctx.font = `bold ${SIZES.small(game)}px ${FONTS.word}`
    game.ctx.fillText(remainingWordsHeader, menuBarPadding, hintsY);
    hintsY += getTextHeight(game.ctx, remainingWordsHeader) - cellSize / 2 + SIZES.teeny(game);

    const tableY = hintsY;
    game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.word}`
    game.ctx.textAlign = "center";
    game.ctx.textBaseline = "middle";
    const letters = [...game.puzzle.letters].sort();

    game.ctx.lineWidth = 2;
    game.ctx.strokeStyle = COLORS.gray(game);
    game.ctx.fillStyle = COLORS.fg(game);
    game.ctx.beginPath();

    const lengthsSet: Set<number> = new Set();
    for (const letterLengthList of Array.from(game.hintsPuzzle.lengths.values())) {
      letterLengthList.forEach((c, i) => {
        if (c > 0) {
          lengthsSet.add(i);
        }
      });
    }
    const lengths = [...lengthsSet].sort((a, b) => a - b);
    const lengthsTotals = Array(lengths.length).fill(0);
    // Table width includes padding
    const tableWidth = (lengths.length + 2) * cellSize + 2 * SIZES.small(game);
    const tableHeight = cellSize * (letters.length + 2);

    // Both being true means the user just started scrolling (or tapping)
    if (game.mouseDown && game.hintsTableUserIsScrolling) {
      game.ctx.beginPath();
      game.ctx.rect(0, tableY, tableWidth, tableHeight);
      if (!game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
        // Pointer isn't inside the table, so don't scroll table
        game.hintsTableUserIsScrolling = false;
      }
    }

    const hintsTableMaxScroll = Math.max(0, tableWidth - game.width);
    [game.hintsTableScroll, game.hintsTableScrollSpeed] = scrolling(game, game.hintsTableScroll, game.hintsTableScrollSpeed, game.hintsTableUserIsScrolling, hintsTableMaxScroll);

    const tableX = SIZES.small(game) - game.hintsTableScroll;
    game.ctx.textBaseline = "top";
    for (let j = 0; j < lengths.length; j++) {
      game.ctx.fillText(lengths[j].toString(),
        tableX + cellSize / 2 + cellSize * (j + 1),
        tableY + cellSize / 2);
    }
    game.ctx.fillText("To.",
      tableX + cellSize / 2 + cellSize * (lengths.length + 1),
      tableY + cellSize / 2);
    game.ctx.beginPath();
    game.ctx.moveTo(tableX, tableY + cellSize);
    game.ctx.lineTo(tableX + (lengths.length + 2) * cellSize, tableY + cellSize);
    game.ctx.stroke();
    game.ctx.textBaseline = "middle";
    let interactingWithBox: { letter: string, count: number } | null = null;
    for (let i = 0; i < 7; i++) {
      const letter = letters[i].toLowerCase();
      game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.word}`
      game.ctx.fillText(letter.toUpperCase(),
        tableX + cellSize / 2,
        tableY + cellSize / 2 + cellSize * (i + 1));

      const puzzleLengths = game.hintsPuzzle.lengths.get(letter) ?? [];
      const foundLengths = game.hintsFound.lengths.get(letter) ?? [];
      game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.word}`
      lengths.forEach((length, j) => {
        const count = puzzleLengths[length] - (foundLengths[length] ?? 0);
        lengthsTotals[j] += count;
        if (count > 0) {
          game.ctx.beginPath();
          game.ctx.roundRect(tableX + 1 + cellSize * (j + 1), tableY + 2 + cellSize * (i + 1), cellSize - 2, cellSize - 4, SIZES.teeny(game));
          // Detect interaction
          if (game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
            interactingWithBox = { letter, count };
            game.ctx.fillStyle = COLORS.darkyellow(game);
          } else {
            game.ctx.fillStyle = COLORS.yellow(game);
          }
          game.ctx.fill();
          game.ctx.fillStyle = COLORS.fg(game);
          game.ctx.fillText((count).toString(),
            tableX + cellSize / 2 + cellSize * (j + 1),
            tableY + cellSize / 2 + cellSize * (i + 1));
        }
      });

      game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.word}`
      const total = puzzleLengths.reduce((sum, c) => sum + c, 0)
        - foundLengths.reduce((sum, c) => sum + c, 0);
      game.ctx.fillText((total || "").toString(),
        tableX + cellSize / 2 + cellSize * (lengths.length + 1),
        tableY + cellSize / 2 + cellSize * (i + 1));

      game.ctx.beginPath();
      game.ctx.moveTo(tableX, tableY + cellSize * (i + 2));
      game.ctx.lineTo(tableX + (lengths.length + 2) * cellSize, tableY + cellSize * (i + 2));
      game.ctx.stroke();
    }
    game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.word}`
    for (let j = -1; j < lengths.length; j++) {
      game.ctx.fillText((j === -1 ? "To." : (lengthsTotals[j] || "")).toString(),
        tableX + cellSize / 2 + cellSize * (j + 1),
        tableY + cellSize / 2 + cellSize * (letters.length + 1));
    }
    const total = lengthsTotals.reduce((sum, c) => sum + c, 0);
    game.ctx.fillText((total || "").toString(),
      tableX + cellSize / 2 + cellSize * (lengths.length + 1),
      tableY + cellSize / 2 + cellSize * (letters.length + 1));
    game.ctx.beginPath();
    game.ctx.moveTo(tableX, tableY + cellSize * (letters.length + 2));
    game.ctx.lineTo(tableX + (lengths.length + 2) * cellSize, tableY + cellSize * (letters.length + 2));
    game.ctx.stroke();

    hintsY += tableHeight + SIZES.small(game);

    game.ctx.fillStyle = COLORS.fg(game);
    game.ctx.textAlign = "left";
    game.ctx.textBaseline = "top";
    const remainingStartsHeader = "Remaining starts";
    game.ctx.font = `bold ${SIZES.small(game)}px ${FONTS.word}`
    game.ctx.fillText(remainingStartsHeader, menuBarPadding, hintsY);
    hintsY += getTextHeight(game.ctx, remainingStartsHeader) + SIZES.teeny(game);

    game.ctx.textAlign = "center";
    game.ctx.textBaseline = "middle";
    const startsX = SIZES.small(game);
    let j = 0;
    const starts = Array.from(game.hintsPuzzle.starts.entries());
    starts.sort(([a, _], [b, __]) => a.localeCompare(b));
    for (const [start, puzzleCount] of starts) {
      const foundCount = game.hintsFound.starts.get(start);
      const count = puzzleCount - (foundCount ?? 0);

      // Skip starts that have been found
      if (count === 0) {
        continue;
      }

      // Start a new line if this one it would overflow
      const lineWidth = startsX + cellSize * (j + 2);
      if (lineWidth > game.width - SIZES.small(game)) {
        hintsY += cellSize + SIZES.tiny(game);
        j = 0;
      }

      // Gray border unifying the start and the count
      game.ctx.beginPath();
      game.ctx.moveTo(startsX + SIZES.teeny(game) + cellSize * j, hintsY + cellSize);
      game.ctx.lineTo(startsX + cellSize * (j + 2), hintsY + cellSize);
      game.ctx.strokeStyle = COLORS.gray(game);
      game.ctx.stroke();
      // Display the start
      game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.word}`
      game.ctx.fillText(start.toUpperCase(),
        startsX + cellSize / 2 + cellSize * j,
        hintsY + cellSize / 2);
      // Display the count in the an interactive yellow box
      game.ctx.beginPath();
      game.ctx.roundRect(startsX + 1 + cellSize * (j + 1),
        hintsY + 2,
        cellSize - 2,
        cellSize - 4,
        SIZES.teeny(game));
      // Detect interaction
      if (game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
        interactingWithBox = { letter: start, count };
        game.ctx.fillStyle = COLORS.darkyellow(game);
      } else {
        game.ctx.fillStyle = COLORS.yellow(game);
      }
      game.ctx.fill();
      game.ctx.fillStyle = COLORS.fg(game);
      game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.word}`
      game.ctx.fillText(count.toString(),
        startsX + cellSize / 2 + cellSize * (j + 1),
        hintsY + cellSize / 2);

      j += 2;
    }
    // Account for the last row and a little padding
    hintsY += cellSize + SIZES.tiny(game) + SIZES.small(game);

    // Save the height of the hints for scrolling limits (add the scrolling since
    // hintsY depends on it)
    game.hintsHeight = hintsY + game.hintsScroll;

    if (interactingWithBox != null) {
      // When interacting with a box, show a little info message over the hints

      const interactiveHeight = SIZES.big(game);
      const interactiveY = game.height - interactiveHeight - SIZES.tiny(game);
      const interactiveWidth = game.width - 2 * SIZES.big(game);
      const interactiveX = game.width / 2 - interactiveWidth / 2;

      game.ctx.beginPath();
      game.ctx.roundRect(interactiveX, interactiveY, interactiveWidth, interactiveHeight, SIZES.teeny(game));
      game.ctx.fillStyle = COLORS.bg(game);
      game.ctx.strokeStyle = COLORS.fg(game);
      game.ctx.lineWidth = 1;
      game.ctx.fill();
      game.ctx.stroke();

      const { letter, count } = interactingWithBox;
      const firstLine = `There ${count === 1 ? "is" : "are"} ${count} more word${count === 1 ? "" : "s"}`
      const secondLine = `that start${count === 1 ? "s" : ""} with ${letter.toUpperCase()}.`;

      game.ctx.fillStyle = COLORS.fg(game);
      game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`
      game.ctx.textAlign = "center";

      game.ctx.textBaseline = "bottom";
      game.ctx.fillText(firstLine,
        game.width / 2,
        interactiveY + interactiveHeight / 2);
      game.ctx.textBaseline = "top";
      game.ctx.fillText(secondLine,
        game.width / 2,
        interactiveY + interactiveHeight / 2);
    }

    // Restore to remove clipping
    game.ctx.restore();
  }
}

/**
 * Draw the hexagon letter wheel
 */
function wheel(time: DOMHighResTimeStamp, game: Game) {
  let clicked = "";
  const hexRadius = SIZES.big(game);

  game.ctx.font = `bold ${hexRadius}px ${FONTS.word}`
  game.ctx.textAlign = "center";
  game.ctx.textBaseline = "middle";

  // Center hexagon
  const centerX = game.width / 2;
  const centerY = game.height - hexRadius * 4.5;
  hexagon(game.ctx, centerX, centerY, hexRadius);
  game.ctx.fillStyle = COLORS.yellow(game);
  if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.clickedHex = 0;
      game.clickedHexTime = time;
      clicked = game.puzzle.letters[0];
      game.ctx.fillStyle = COLORS.darkyellow(game);
    }
  }
  if (game.clickedHex === 0 && game.clickedHexTime != null) {
    const duration = 200;
    let t = (time - game.clickedHexTime) / duration;
    if (t < 1) {
      // Hex shrinks then grows
      if (t > 0.5) {
        t = 1 - t;
      }
      window.requestAnimationFrame((time) => main(time, game));
      const clickedHexRadius = (1 - t) * hexRadius + t * (0.8 * hexRadius);
      hexagon(game.ctx, centerX, centerY, clickedHexRadius);
    } else {
      game.clickedHex = null;
      game.clickedHexTime = null;
    }
  }
  game.ctx.fill();
  game.ctx.fillStyle = COLORS.fg(game);
  game.ctx.fillText(game.puzzle.letters[0], centerX, centerY);

  // Surrounding hexagons
  const radians = 2 * Math.PI / 6;
  const radius = 1.9 * hexRadius;
  for (let i = 1; i <= 6; i++) {
    const x = centerX + Math.cos(radians * i + radians / 2) * radius;
    const y = centerY + Math.sin(radians * i + radians / 2) * radius;
    hexagon(game.ctx, x, y, hexRadius);
    game.ctx.fillStyle = COLORS.gray(game);
    if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
      if (game.mouseDown) {
        game.mouseDown = false;
        game.clickedHex = i;
        game.clickedHexTime = time;
        clicked = game.puzzle.letters[i];
        game.ctx.fillStyle = COLORS.darkgray(game);
      }
    }
    if (game.clickedHex === i && game.clickedHexTime != null) {
      const duration = 200;
      let t = (time - game.clickedHexTime) / duration;
      if (t < 1) {
        // Hex shrinks then grows
        if (t > 0.5) {
          t = 1 - t;
        }
        window.requestAnimationFrame((time) => main(time, game));
        const clickedHexRadius = (1 - t) * hexRadius + t * (0.8 * hexRadius);
        hexagon(game.ctx, x, y, clickedHexRadius);
      } else {
        game.clickedHex = null;
        game.clickedHexTime = null;
      }
    }
    game.ctx.fill();
    game.ctx.fillStyle = COLORS.fg(game);
    game.ctx.fillText(game.puzzle.letters[i], x, y);
  }

  return clicked;
}

function word(_time: DOMHighResTimeStamp, game: Game) {
  const wordY = game.height - SIZES.big(game) * 8;

  const text = game.wordMessage ?? game.puzzle.word;

  let fontsize = SIZES.medium(game);
  game.ctx.font = `bold ${fontsize}px ${FONTS.word}`;
  game.ctx.textBaseline = "middle";
  game.ctx.fillStyle = COLORS.fg(game);
  let wordWidth = game.ctx.measureText(text).width;
  while (wordWidth > game.width * 0.75) {
    fontsize = fontsize * 0.95;
    game.ctx.font = `bold ${fontsize}px ${FONTS.word}`;
    wordWidth = game.ctx.measureText(text).width;
  }

  // If there's a wordMessage, display that instead of the word
  if (game.wordMessage != null) {
    game.ctx.textAlign = "center";
    game.ctx.fillStyle = COLORS.darkgray(game);
    game.ctx.fillText(game.wordMessage, game.width / 2, wordY);
    return;
  }

  game.ctx.textAlign = "left";
  let letterX = game.width / 2 - wordWidth / 2;
  for (const letter of game.puzzle.word) {
    game.ctx.fillStyle = letter === game.puzzle.letters[0] ? COLORS.yellow(game) : COLORS.fg(game);
    game.ctx.fillText(letter, letterX, wordY);
    letterX += game.ctx.measureText(letter).width;
  }
}

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function submitWord(game: Game, word?: string) {
  const enteredWord = removeAccents(word ?? game.puzzle.word.toLowerCase());
  game.puzzle.word = "";

  if (Object.hasOwn(game.puzzle.words, enteredWord)) {
    // The entered word has no accents, i.e. is normalized, so normalize the
    // found words before checking if this word has already been found
    if (game.puzzle.found.map(removeAccents).includes(enteredWord)) {
      game.wordMessage = "Already found";
    } else {
      let count = 0;
      let score = 0;
      for (const word of game.puzzle.words[enteredWord]) {
        game.puzzle.found.unshift(word);
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
      game.wordMessage = `+${score / count}${count > 1 ? ` x${count}` : ""}`;
      savePuzzle(game);
    }
  } else if (DEBUG.allowAnyWord) {
    game.puzzle.found.unshift(enteredWord);
    const score = scoreWord(enteredWord, game.puzzle.pangrams);
    game.puzzle.score += score;
    game.wordMessage = `+${score} !`;
    savePuzzle(game);
  } else {
    if (enteredWord.length < 4) {
      game.wordMessage = "Too short";
    } else if (![...enteredWord].some(l => l.toUpperCase() === game.puzzle.letters[0])) {
      game.wordMessage = "Missing center letter";
    } else {
      game.wordMessage = "Not in word list";
    }
  }
}

function controls(_time: DOMHighResTimeStamp, game: Game) {
  const controlY = game.height - SIZES.big(game);
  const controlRadius = SIZES.small(game);
  const controlWidth = controlRadius * 4;
  const controlsWidth = controlWidth * 2 + controlRadius + SIZES.medium(game) * 2;
  game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
  game.ctx.textAlign = "center";
  game.ctx.textBaseline = "middle";
  game.ctx.strokeStyle = COLORS.fg(game);

  // Delete
  const deleteX = game.width / 2 - controlsWidth / 2;
  game.ctx.beginPath();
  game.ctx.roundRect(deleteX, controlY - controlRadius, controlWidth, controlRadius * 2, controlRadius);
  game.ctx.fillStyle = COLORS.bg(game);
  if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.ctx.fillStyle = COLORS.darkgray(game);
      game.puzzle.word = game.puzzle.word.substring(0, game.puzzle.word.length - 1);
      window.requestAnimationFrame((time) => main(time, game));
    }
  }
  game.ctx.lineWidth = 1;
  game.ctx.stroke();
  game.ctx.fill();
  game.ctx.fillStyle = COLORS.fg(game);
  game.ctx.fillText("Delete", deleteX + controlWidth / 2, controlY);

  // Shuffle
  game.ctx.beginPath();
  game.ctx.arc(game.width / 2, controlY, controlRadius, 0, 2 * Math.PI)
  game.ctx.fillStyle = COLORS.bg(game);
  if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.ctx.fillStyle = COLORS.darkgray(game);
      game.puzzle.letters = game.puzzle.letters
        .map((letter, i) => ({ letter, sort: i === 0 ? 0 : Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ letter }) => letter);
      window.requestAnimationFrame((time) => main(time, game));
    }
  }
  game.ctx.lineWidth = 1;
  game.ctx.stroke();
  game.ctx.fill();
  // Shuffle symbol
  game.ctx.save();
  game.ctx.translate(game.width / 2, controlY);
  game.ctx.rotate(-Math.PI / 4);

  // Arrow lines
  const arrowLineArcAngle = 7 * Math.PI / 8;
  game.ctx.beginPath();
  game.ctx.arc(0, 0, SIZES.tiny(game), 2 * Math.PI / 4, 2 * Math.PI / 4 + arrowLineArcAngle);
  game.ctx.stroke();
  game.ctx.beginPath();
  game.ctx.arc(0, 0, SIZES.tiny(game), 6 * Math.PI / 4, 6 * Math.PI / 4 + arrowLineArcAngle);
  game.ctx.stroke();

  // Upper arrow head
  game.ctx.save();
  game.ctx.translate(0, -SIZES.tiny(game));
  // π/4.5 based on aesthetic (around π/6 should be correct)
  game.ctx.rotate(-Math.PI / 4.5);
  game.ctx.beginPath();
  game.ctx.moveTo(0, 0);
  game.ctx.lineTo(SIZES.teeny(game), 0);
  game.ctx.moveTo(0, 0);
  game.ctx.lineTo(0, SIZES.teeny(game));
  game.ctx.stroke();
  game.ctx.restore();

  // Lower arrow head
  game.ctx.save();
  game.ctx.translate(0, SIZES.tiny(game));
  game.ctx.rotate(Math.PI - Math.PI / 4.5);
  game.ctx.beginPath();
  game.ctx.moveTo(0, 0);
  game.ctx.lineTo(SIZES.teeny(game), 0);
  game.ctx.moveTo(0, 0);
  game.ctx.lineTo(0, SIZES.teeny(game));
  game.ctx.stroke();
  game.ctx.restore();

  game.ctx.restore();

  // Enter
  const enterX = game.width / 2 + controlsWidth / 2 - controlWidth;
  game.ctx.beginPath();
  game.ctx.roundRect(enterX, controlY - controlRadius, controlWidth, controlRadius * 2, controlRadius);
  game.ctx.fillStyle = COLORS.bg(game);
  if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.ctx.fillStyle = COLORS.darkgray(game);

      submitWord(game);

      window.requestAnimationFrame((time) => main(time, game));
    }
  }
  game.ctx.lineWidth = 1;
  game.ctx.stroke();
  game.ctx.fill();
  game.ctx.fillStyle = COLORS.fg(game);
  game.ctx.fillText("Enter", enterX + controlWidth / 2, controlY);
}

const SCORERANKS: [number, string][] = [
  [0, "Beginner"],
  [0.02, "Good Start"],
  [0.05, "Moving Up"],
  [0.08, "Good"],
  [0.15, "Solid"],
  [0.25, "Nice"],
  [0.40, "Great"],
  [0.50, "Amazing"],
  [0.70, "Genius"],
  [1, "Queen Bee"]
];

function scorebar(_time: DOMHighResTimeStamp, game: Game) {
  let rank = SCORERANKS.findIndex(
    ([minScore, _]) => game.puzzle.score < Math.round(minScore * game.puzzle.maxScore)) - 1;
  // Rank is Queen Bee if no min score is < the score
  if (rank === -2) {
    rank = SCORERANKS.length - 1;
  }

  const scorebarWidth = game.width - 2 * SIZES.tiny(game);
  const scorebarX = game.width / 2 - scorebarWidth / 2;
  const scorebarY = 3 * SIZES.small(game);
  game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.default}`;
  const rankWidth = SIZES.tiny(game)
    + Math.max(...SCORERANKS.map((([_, rank]) => game.ctx.measureText(rank).width)));

  // Score bar
  let displayRank = SCORERANKS[rank][1];
  game.ctx.beginPath();
  game.ctx.moveTo(scorebarX + rankWidth, scorebarY);
  game.ctx.lineTo(scorebarX + scorebarWidth, scorebarY);
  game.ctx.strokeStyle = COLORS.gray(game);
  game.ctx.stroke();
  // Score ticks
  game.ctx.textBaseline = "middle";
  const tickWidth = (scorebarWidth - rankWidth - 2 * SIZES.teeny(game)) / (SCORERANKS.length - 1);
  // Only allow interacting with one tick at a time by defaulting to undefined
  // and only allow interaction when undefined. At the end of the loop of the
  // interacted with tick, set to false to disable further interaction.
  let interactingWithTick = undefined;
  for (let i = 0; i < SCORERANKS.length; i++) {
    const tickX = scorebarX + rankWidth + SIZES.teeny(game) + i * tickWidth;

    let tickRadius = SIZES.teeny(game);
    if (i === rank) {
      tickRadius = SIZES.tiny(game);
    }
    // Temporary extra large tick mark to check for interaction
    game.ctx.beginPath();
    game.ctx.arc(tickX, scorebarY, SIZES.tiny(game), 0, 2 * Math.PI);
    if (interactingWithTick === undefined && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
      interactingWithTick = true;
      // Increase radius of tick when interacting
      tickRadius = SIZES.tiny(game);
    }

    if (i <= rank) {
      game.ctx.fillStyle = COLORS.yellow(game);
    } else {
      game.ctx.fillStyle = COLORS.gray(game);
    }

    game.ctx.beginPath();
    game.ctx.arc(tickX, scorebarY, tickRadius, 0, 2 * Math.PI);
    game.ctx.fill();

    game.ctx.textAlign = "center";
    game.ctx.fillStyle = COLORS.fg(game);
    if (interactingWithTick) {
      // Display min score for rank if interacting
      game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.word}`;
      game.ctx.fillText(Math.round(game.puzzle.maxScore * SCORERANKS[i][0]).toString(), tickX, scorebarY);
      // Change rank to this tick's rank while interacting
      displayRank = SCORERANKS[i][1];
    } else if (i === rank) {
      // Display current score if this is the current rank
      game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.word}`;
      game.ctx.fillText(game.puzzle.score.toString(), tickX, scorebarY);
    }

    if (interactingWithTick) {
      interactingWithTick = false;
    }
  }

  // Rank
  game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.default}`;
  game.ctx.textAlign = "left";
  game.ctx.textBaseline = "middle";
  game.ctx.fillStyle = COLORS.fg(game);
  game.ctx.fillText(displayRank, scorebarX, scorebarY);
}

function wordlist(_time: DOMHighResTimeStamp, game: Game) {
  const wordlistWidth = game.width - 2 * SIZES.tiny(game);
  const wordlistX = game.width / 2 - wordlistWidth / 2;
  const wordlistY = 4 * SIZES.small(game);
  const wordlistHeight = game.wordlistIsOpen ? game.height - wordlistY - SIZES.small(game) : game.height / 20;

  game.ctx.beginPath();
  game.ctx.roundRect(wordlistX, wordlistY, wordlistWidth, wordlistHeight, SIZES.teeny(game));
  game.ctx.strokeStyle = game.revealAnswers ? COLORS.yellow(game) : COLORS.fg(game);
  game.ctx.fillStyle = COLORS.bg(game);
  game.ctx.fill();
  game.ctx.stroke();

  game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
  game.ctx.textAlign = "left";
  game.ctx.textBaseline = "middle";

  // Opened wordlist
  if (game.wordlistIsOpen) {
    // Clip to only display text inside the wordlist
    game.ctx.save();
    game.ctx.clip();

    game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.default}`;
    const textHeight = getTextHeight(game.ctx, "A") * 2;

    // Get the wordlist and sort it alphabetically
    let list = [...game.puzzle.found];
    if (game.revealAnswers) {
      // Revealing answers, so show all words
      list = Object.values(game.puzzle.words).flat();
    }
    list.sort((a, b) => a.localeCompare(b));

    // Restrict scrolling
    const rows = Math.ceil(list.length / 2) + 1;
    const wordlistInnerHeight = (rows + 1) * textHeight - wordlistHeight;
    const wordlistMaxScroll = Math.max(0, wordlistInnerHeight);
    [game.wordlistScroll, game.wordlistScrollSpeed] = scrolling(game, game.wordlistScroll, game.wordlistScrollSpeed, game.wordlistUserIsScrolling, wordlistMaxScroll);

    game.ctx.fillStyle = COLORS.fg(game);

    const textY = wordlistY + textHeight - game.wordlistScroll;
    const leftX = wordlistX + SIZES.tiny(game);
    const rightX = wordlistX + wordlistWidth / 2 + SIZES.tiny(game);
    let count = 0;
    game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
    game.ctx.fillText(`${game.puzzle.found.length} word${count === 1 ? "" : "s"} found`, leftX, textY);

    for (const word of list) {
      const weight = game.puzzle.pangrams.includes(word) ? "bold" : "";
      game.ctx.font = `${weight} ${SIZES.tiny(game)}px ${FONTS.default}`;
      game.ctx.fillStyle = game.puzzle.found.includes(word) ? COLORS.fg(game) : COLORS.yellow(game);
      const wordY = textY + textHeight * (Math.floor(count / 2) + 1);
      if (count % 2 === 0) {
        game.ctx.fillText(word, leftX, wordY);
      } else {
        game.ctx.fillText(word, rightX, wordY);
      }
      count++;
    }

    game.ctx.beginPath();
    game.ctx.moveTo(game.width / 2, wordlistY + textHeight / 2);
    game.ctx.lineTo(game.width / 2, wordlistY + wordlistHeight - textHeight / 2);
    game.ctx.strokeStyle = COLORS.gray(game);
    game.ctx.stroke();

    // Restore previous clipping
    game.ctx.restore();
  } else {
    // Stop scrolling
    game.wordlistScrollSpeed = 0;
  }

  // Wordlist preview
  if (!game.wordlistIsOpen) {
    let previewSize = 0;
    const textX = wordlistX + SIZES.tiny(game);
    const padding = SIZES.teeny(game);
    game.ctx.fillStyle = COLORS.fg(game);
    game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
    const elipsisSize = game.ctx.measureText("...").width;
    for (const word of game.puzzle.found) {
      game.ctx.font = `${game.puzzle.pangrams.includes(word) ? "bold" : ""} ${SIZES.tiny(game)}px ${FONTS.default}`;
      const wordSize = game.ctx.measureText(`${word}`).width;
      if (previewSize + wordSize + elipsisSize + padding > wordlistWidth - SIZES.tiny(game) * 2) {
        game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
        game.ctx.fillText("...", textX + previewSize, wordlistY + wordlistHeight / 2);
        break;
      }
      game.ctx.fillText(word, textX + previewSize, wordlistY + wordlistHeight / 2);
      previewSize += wordSize + padding;
    }

    // Toggle the wordlist being open when you click on it
    game.ctx.beginPath();
    game.ctx.roundRect(wordlistX, wordlistY, wordlistWidth, wordlistHeight, SIZES.teeny(game));
    if (game.mouseDown && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
      game.mouseDown = false;
      game.wordlistIsOpen = !game.wordlistIsOpen;
      window.requestAnimationFrame((time) => main(time, game));
    }
  }
}

function isPangram(word: string, pangrams: string[]): boolean {
  return pangrams.includes(word);
}

function scoreWord(word: string, pangrams: string[]): number {
  if (word.length === 4) {
    return 1;
  }

  return word.length + (isPangram(word, pangrams) ? 7 : 0);
}


/**
 * Path a hexagon centered at x, y with specified radius. Rotated to have a side
 * at the top and bottom, and a vertex at the left and right. Does not draw!
 */
function hexagon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  const sides = 6;
  const radians = 2 * Math.PI / sides;

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  for (let i = 1; i <= sides; i++) {
    ctx.lineTo(x + Math.cos(radians * i) * radius, y + Math.sin(radians * i) * radius);
  }
}

/**
 * Gets the height of the text as it would be rendered on the Canvas.
 */
function getTextHeight(ctx: CanvasRenderingContext2D, text: string): number {
  return ctx.measureText(text).fontBoundingBoxAscent + ctx.measureText(text).fontBoundingBoxDescent;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number): number {
  let height = 0;
  let line = "";
  const words = text.split(" ");
  for (const word of words) {
    // Add words to the line as long as the result fits within the width
    if (ctx.measureText(line).width + ctx.measureText(`${word} `).width <= width) {
      line += `${word} `;
      continue;
    }
    // Write the current line
    ctx.fillText(line, x, y + height);
    // Start a new line with this word
    height += getTextHeight(ctx, line);
    line = `${word} `;
  }
  // Write whatever is left
  ctx.fillText(line, x, y + height);
  height += getTextHeight(ctx, line);
  return height;
}

/**
 * Handles scrolling logic, including updating scroll, inertia, and restricting scroll.
 * @param {Game} game the game object for requesting new frames when scrolling by inertia
 * @param {number} scroll the amount scrolled so far
 * @param {number} scrollSpeed the speed at which the scrolling is progressing
 * @param {boolean} userIsScrolling whether the user is current scrolling themselves
 * @param {number} maximumScroll the maximum amount of scrolling allowed
 * @returns {[number, number, boolean]} a 3-tuple of the new scroll distance and scroll speed
 */
function scrolling(game: Game, scroll: number, scrollSpeed: number, userIsScrolling: boolean, maximumScroll: number): [number, number] {
  let newScroll = scroll;
  let newScrollSpeed = scrollSpeed;

  // Update scroll while user is scrolling
  if (userIsScrolling) {
    newScroll -= scrollSpeed;
  }

  // Scrolling inertia
  if (!userIsScrolling && scrollSpeed !== 0) {
    // The user is not currently scrolling and scroll speed is positive, i.e. scrolling via "inertia"
    newScroll -= scrollSpeed;
    newScrollSpeed *= 0.97;

    // Enforce a minimum speed
    if (Math.abs(newScrollSpeed) < 0.1) {
      newScrollSpeed = 0;
    }

    window.requestAnimationFrame((time) => main(time, game));
  }

  // Restrict scrolling
  if (newScroll < 0) {
    // No need to scroll up
    newScroll = 0;
    newScrollSpeed = 0;
  } else if (scroll > maximumScroll) {
    // No need to bring the end of the list above the bottom
    newScroll = maximumScroll;
    newScrollSpeed = 0;
  }

  return [newScroll, newScrollSpeed];
}
