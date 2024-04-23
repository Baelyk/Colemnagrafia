import { invoke } from "@tauri-apps/api/core";
import { Store } from '@tauri-apps/plugin-store';

const DEBUG = {
  allowAnyWord: false,
  foundAllWords: false,
  eventLogging: false,
}

const COLORS = {
  yellow: "gold",
  darkyellow: "goldenrod",
  black: "black",
  gray: "lightgray",
  darkgray: "darkgray",
  red: "red",
  white: "white",
};

const FONTS = {
  default: "sans-serif",
  word: "JetBrains Mono, monospace",
}

interface HasSize {
  width: number;
  height: number;
}
const SIZES = {
  smallestDimension: (size: HasSize) => Math.min(size.height, size.width),
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

  errorText: string | null;

  puzzle: Puzzle;

  mouseX: number;
  mouseY: number;
  mouseDown: boolean;

  clickedHex: number | null;
  clickedHexTime: DOMHighResTimeStamp | null;

  wordMessage: string | null;

  wordlistIsOpen: boolean;
  wordlistToggleTime: DOMHighResTimeStamp | null;
  wordlistScroll: number;
  wordlistScrollSpeed: number;
  /** Whether the user is currently scrolling (i.e. finger moving the list) */
  wordlistUserIsScrolling: boolean;
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

window.addEventListener("DOMContentLoaded", async () => {
  const game = init();
  if (game == null) {
    console.error("Error initializing game");
    return;
  }
  // For debugging, log the game
  console.debug(game);

  try {
    await loadPuzzle(game);
  } catch (error) {
    console.error("Puzzle generation failed");
    console.debug(error);
    game.errorText = JSON.stringify(error);
  }


  window.addEventListener("click", (event) => {
    if (DEBUG.eventLogging) console.log("click");
    game.mouseX = event.clientX * game.scaling;
    game.mouseY = event.clientY * game.scaling;
    game.mouseDown = true;
    game.wordMessage = null;
    window.requestAnimationFrame((time) => main(time, game));
  });

  window.addEventListener("mousemove", (event) => {
    if (DEBUG.eventLogging) console.log("mouse");
    game.mouseX = event.clientX * game.scaling;
    game.mouseY = event.clientY * game.scaling;
    game.mouseDown = false;
    window.requestAnimationFrame((time) => main(time, game));
  });

  window.addEventListener("resize", () => {
    if (DEBUG.eventLogging) console.log("resize");
    game.width = window.innerWidth;
    game.height = window.innerHeight;
    game.scaling = window.devicePixelRatio;
    resizeCanvas(game.ctx.canvas, game.width, game.height);

    window.requestAnimationFrame((time) => main(time, game));
  });

  window.addEventListener("wheel", (event) => {
    if (DEBUG.eventLogging) console.log("wheel");
    if (!game.wordlistIsOpen) {
      return;
    }

    game.wordlistScroll += event.deltaY;

    window.requestAnimationFrame((time) => main(time, game));
  });

  window.addEventListener("pointermove", (event) => {
    if (DEBUG.eventLogging) console.log("pointermove");
    console.debug(event);
    if (!game.wordlistIsOpen) {
      return;
    }

    game.wordlistScroll -= event.movementY;
    game.wordlistScrollSpeed = event.movementY;
    game.wordlistUserIsScrolling = true;

    window.requestAnimationFrame((time) => main(time, game));
  });

  window.addEventListener("pointerup", (event) => {
    if (DEBUG.eventLogging) console.log("pointerup");
    console.debug(event);
    if (!game.wordlistIsOpen) {
      return;
    }

    game.wordlistUserIsScrolling = false;

    window.requestAnimationFrame((time) => main(time, game));
  });

  window.requestAnimationFrame((time) => main(time, game));
});

function resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const ratio = window.devicePixelRatio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = width * ratio;
  canvas.height = height * ratio;

  const ctx = canvas.getContext("2d");
  if (ctx == null) {
    console.error("Unable to get canvas context");
    return;
  }
  ctx.scale(ratio, ratio);
}

function init(): Game {
  console.log("Initializing...");
  const canvas = document.querySelector("canvas");
  if (canvas == null) {
    console.error("Unable to get canvas");
    throw new Error("Unable to get canvas");
  }
  const ctx = canvas.getContext("2d");
  if (ctx == null) {
    console.error("Unable to get canvas context");
    throw new Error("Unable to get canvas context");
  }

  const scaling = window.devicePixelRatio;
  const width = window.innerWidth;
  const height = window.innerHeight;
  resizeCanvas(canvas, width, height);

  const puzzle: Puzzle = {
    letters: [],
    words: {},
    pangrams: [],
    maxScore: 0,
    word: "",
    found: [],
    score: 0,
  };

  return {
    width,
    height,
    scaling,
    ctx,

    errorText: null,

    puzzle,

    mouseX: -1,
    mouseY: -1,
    mouseDown: false,

    clickedHex: null,
    clickedHexTime: null,

    wordMessage: null,

    wordlistIsOpen: false,
    wordlistToggleTime: null,
    wordlistScroll: 0,
    wordlistScrollSpeed: 0,
    wordlistUserIsScrolling: false,
  };
}

async function savePuzzle(game: Game) {
  console.log("Saving puzzle state");
  const store = new Store("store.dat");
  await store.set("puzzle", game.puzzle);
  // Manually save the store now as well (instead of hoping for a graceful exit)
  await store.save();
}

async function loadPuzzle(game: Game) {
  const store = new Store("store.dat");
  let storedPuzzle: Puzzle | null = null;
  let storedPuzzleDate: string | null = null;

  try {
    console.log("Loading puzzle...");
    storedPuzzle = await store.get<Puzzle>("puzzle");
    storedPuzzleDate = await store.get<string>("puzzle-date");
  } catch (error) {
    console.error("Failed to get stored puzzle:");
    console.error(error);
  }

  const today = new Date(Date.now()).toDateString();
  if (storedPuzzleDate != null && storedPuzzle != null) {
    console.debug(`Loaded stored puzzle state from ${storedPuzzleDate}`);
    console.debug(storedPuzzle);
    if (storedPuzzleDate === today) {
      console.log("Stored puzzle is from today, using it");
      game.puzzle = storedPuzzle;
      return;
    }
  }

  console.log("Creating a new puzzle...");
  const puzzle = await invoke("daily_puzzle") as [string[], WordMap, string[]];
  game.puzzle.letters = puzzle[0].map(l => l.toUpperCase());
  game.puzzle.words = puzzle[1];
  game.puzzle.pangrams = puzzle[2];
  game.puzzle.maxScore = Object.values(game.puzzle.words).flat().reduce(
    (sum, word) => sum + scoreWord(word, game.puzzle.pangrams), 0);
  game.puzzle.word = "";
  game.puzzle.found = [];
  if (DEBUG.foundAllWords) {
    game.puzzle.found = Object.values(game.puzzle.words).flat();
  }
  game.puzzle.score = 0;

  await store.set("puzzle-date", today);
  savePuzzle(game);
}

function main(time: DOMHighResTimeStamp, game: Game) {
  game.ctx.clearRect(0, 0, game.width, game.height);

  if (game.errorText != null) {
    error(time, game);
    return;
  }

  if (game.puzzle.letters.length === 0) {
    loading(time, game);
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
  game.ctx.fillStyle = COLORS.black;

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
  game.ctx.fillStyle = COLORS.yellow;
  if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.clickedHex = 0;
      game.clickedHexTime = time;
      clicked = game.puzzle.letters[0];
      game.ctx.fillStyle = COLORS.darkyellow;
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
  game.ctx.fillStyle = COLORS.black;
  game.ctx.fillText(game.puzzle.letters[0], centerX, centerY);

  // Surrounding hexagons
  const radians = 2 * Math.PI / 6;
  const radius = 1.9 * hexRadius;
  for (let i = 1; i <= 6; i++) {
    const x = centerX + Math.cos(radians * i + radians / 2) * radius;
    const y = centerY + Math.sin(radians * i + radians / 2) * radius;
    hexagon(game.ctx, x, y, hexRadius);
    game.ctx.fillStyle = COLORS.gray;
    if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
      if (game.mouseDown) {
        game.mouseDown = false;
        game.clickedHex = i;
        game.clickedHexTime = time;
        clicked = game.puzzle.letters[i];
        game.ctx.fillStyle = COLORS.darkgray;
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
    game.ctx.fillStyle = COLORS.black;
    game.ctx.fillText(game.puzzle.letters[i], x, y);
  }

  return clicked;
}

function word(_time: DOMHighResTimeStamp, game: Game) {
  const wordY = game.height - SIZES.big(game) * 8;

  let fontsize = SIZES.medium(game);
  game.ctx.font = `bold ${fontsize}px ${FONTS.word}`;
  game.ctx.textBaseline = "middle";
  game.ctx.fillStyle = COLORS.black;
  let wordWidth = game.ctx.measureText(game.puzzle.word).width;
  while (wordWidth > game.width * 0.75) {
    fontsize = fontsize * 0.95;
    game.ctx.font = `bold ${fontsize}px ${FONTS.word}`;
    wordWidth = game.ctx.measureText(game.puzzle.word).width;
  }

  // If there's a wordMessage, display that instead of the word
  if (game.wordMessage != null) {
    game.ctx.textAlign = "center";
    game.ctx.fillStyle = COLORS.darkgray;
    game.ctx.fillText(game.wordMessage, game.width / 2, wordY);
    return;
  }

  game.ctx.textAlign = "left";
  let letterX = game.width / 2 - wordWidth / 2;
  for (const letter of game.puzzle.word) {
    game.ctx.fillStyle = letter === game.puzzle.letters[0] ? COLORS.yellow : COLORS.black;
    game.ctx.fillText(letter, letterX, wordY);
    letterX += game.ctx.measureText(letter).width;
  }
}

function submitWord(_time: DOMHighResTimeStamp, game: Game) {
  const enteredWord = game.puzzle.word.toLowerCase();
  game.puzzle.word = "";

  if (Object.hasOwn(game.puzzle.words, enteredWord)) {
    if (game.puzzle.found.includes(enteredWord)) {
      game.wordMessage = "Already found";
    } else {
      let count = 0;
      let score = 0;
      for (const word of game.puzzle.words[enteredWord]) {
        game.puzzle.found.unshift(word);
        score += scoreWord(word, game.puzzle.pangrams);
        count += 1;
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
    } else {
      game.wordMessage = "Not a word";
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
  game.ctx.strokeStyle = COLORS.black;

  // Delete
  const deleteX = game.width / 2 - controlsWidth / 2;
  game.ctx.beginPath();
  game.ctx.roundRect(deleteX, controlY - controlRadius, controlWidth, controlRadius * 2, controlRadius);
  game.ctx.fillStyle = COLORS.white;
  if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.ctx.fillStyle = COLORS.darkgray;
      game.puzzle.word = game.puzzle.word.substring(0, game.puzzle.word.length - 1);
      window.requestAnimationFrame((time) => main(time, game));
    }
  }
  game.ctx.lineWidth = 1;
  game.ctx.stroke();
  game.ctx.fill();
  game.ctx.fillStyle = COLORS.black;
  game.ctx.fillText("Delete", deleteX + controlWidth / 2, controlY);

  // Shuffle
  game.ctx.beginPath();
  game.ctx.arc(game.width / 2, controlY, controlRadius, 0, 2 * Math.PI)
  game.ctx.fillStyle = COLORS.white;
  if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.ctx.fillStyle = COLORS.darkgray;
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

  // Enter
  const enterX = game.width / 2 + controlsWidth / 2 - controlWidth;
  game.ctx.beginPath();
  game.ctx.roundRect(enterX, controlY - controlRadius, controlWidth, controlRadius * 2, controlRadius);
  game.ctx.fillStyle = COLORS.white;
  if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.ctx.fillStyle = COLORS.darkgray;

      submitWord(_time, game);

      window.requestAnimationFrame((time) => main(time, game));
    }
  }
  game.ctx.lineWidth = 1;
  game.ctx.stroke();
  game.ctx.fill();
  game.ctx.fillStyle = COLORS.black;
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
  const rank = SCORERANKS.findIndex(
    ([minScore, _]) => game.puzzle.score < Math.round(minScore * game.puzzle.maxScore)) - 1;

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
  game.ctx.strokeStyle = COLORS.gray;
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
      game.ctx.fillStyle = COLORS.yellow;
    } else {
      game.ctx.fillStyle = COLORS.gray;
    }

    game.ctx.beginPath();
    game.ctx.arc(tickX, scorebarY, tickRadius, 0, 2 * Math.PI);
    game.ctx.fill();

    game.ctx.textAlign = "center";
    game.ctx.fillStyle = COLORS.black;
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
  game.ctx.fillStyle = COLORS.black;
  game.ctx.fillText(displayRank, scorebarX, scorebarY);
}

function wordlist(time: DOMHighResTimeStamp, game: Game) {
  const wordlistWidth = game.width - 2 * SIZES.tiny(game);
  const wordlistX = game.width / 2 - wordlistWidth / 2;
  const wordlistY = 4 * SIZES.small(game);
  const wordlistHeight = game.wordlistIsOpen ? game.height - wordlistY - SIZES.small(game) : game.height / 20;

  game.ctx.beginPath();
  game.ctx.roundRect(wordlistX, wordlistY, wordlistWidth, wordlistHeight, SIZES.teeny(game));
  game.ctx.strokeStyle = COLORS.black;
  game.ctx.fillStyle = COLORS.white;
  game.ctx.fill();
  game.ctx.stroke();

  // Toggle the wordlist being open when you click on it
  if (game.mouseDown && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    game.mouseDown = false;
    game.wordlistIsOpen = !game.wordlistIsOpen;
    game.wordlistToggleTime = time;
    window.requestAnimationFrame((time) => main(time, game));
  }

  game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
  game.ctx.textAlign = "left";
  game.ctx.textBaseline = "middle";

  // Opened wordlist
  if (game.wordlistIsOpen) {
    // Clip to only display text inside the wordlist
    game.ctx.save();
    game.ctx.clip();

    game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.default}`;
    const textHeight = game.ctx.measureText("A").fontBoundingBoxAscent
      + game.ctx.measureText("A").fontBoundingBoxDescent;

    // Scrolling inertia
    if (!game.wordlistUserIsScrolling && game.wordlistScrollSpeed !== 0) {
      // The user is not currently scrolling and scroll speed is positive, i.e.
      // the wordlist is scrolling via "inertia"
      game.wordlistScroll -= game.wordlistScrollSpeed;
      game.wordlistScrollSpeed *= 0.97;
      if (Math.abs(game.wordlistScrollSpeed) < 0.1) {
        game.wordlistScrollSpeed = 0;
      }
      window.requestAnimationFrame((time) => main(time, game));
    } else if (game.wordlistUserIsScrolling) {
      //game.wordlistUserIsScrolling = false;
      //window.requestAnimationFrame((time) => main(time, game));
    }

    // Restrict scrolling
    const rows = Math.ceil(game.puzzle.found.length / 2) + 1;
    // No need to scroll up
    game.wordlistScroll = Math.min(Math.max(0, game.wordlistScroll),
      // No need to bring the end of the list above the bottom
      Math.max(0, (rows + 1) * textHeight - wordlistHeight));

    game.ctx.fillStyle = COLORS.black;

    const textY = wordlistY + textHeight - game.wordlistScroll;
    const leftX = wordlistX + wordlistWidth / 20;
    const rightX = wordlistX + wordlistWidth / 2 + wordlistWidth / 20;
    let count = 0;
    const alphabetical = [...game.puzzle.found].sort((a, b) => a.localeCompare(b));
    game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
    game.ctx.fillText(`${game.puzzle.found.length} word${count === 1 ? "" : "s"} found`, leftX, textY);

    for (const word of alphabetical) {
      game.ctx.font = `${game.puzzle.pangrams.includes(word) ? "bold" : ""} ${SIZES.tiny(game)}px ${FONTS.default}`;
      if (count % 2 === 0) {
        game.ctx.fillText(word, leftX, textY + textHeight * (Math.floor(count / 2) + 1));
      } else {
        game.ctx.fillText(word, rightX, textY + textHeight * (Math.floor(count / 2) + 1));
      }
      count++;
    }

    game.ctx.beginPath();
    game.ctx.moveTo(game.width / 2, wordlistY + textHeight / 2);
    game.ctx.lineTo(game.width / 2, wordlistY + wordlistHeight - textHeight / 2);
    game.ctx.strokeStyle = COLORS.gray;
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
    const padding = SIZES.teeny(game);
    game.ctx.fillStyle = COLORS.black;
    game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
    const elipsisSize = game.ctx.measureText("...").width;
    for (const word of game.puzzle.found) {
      game.ctx.font = `${game.puzzle.pangrams.includes(word) ? "bold" : ""} ${SIZES.tiny(game)}px ${FONTS.default}`;
      const wordSize = game.ctx.measureText(`${word}`).width;
      if (previewSize + wordSize + elipsisSize + padding > wordlistWidth - SIZES.tiny(game) * 2) {
        game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
        game.ctx.fillText("...", wordlistX + SIZES.tiny(game) + previewSize + padding, wordlistY + wordlistHeight / 2);
        break;
      }
      game.ctx.fillText(word, wordlistX + SIZES.tiny(game) + previewSize + padding, wordlistY + wordlistHeight / 2);
      previewSize += wordSize + padding;
    }
  }

}

function isPangram(word: string, pangrams: string[]): boolean {
  return pangrams.includes(word);
}

function scoreWord(word: string, pangrams: string[]): number {
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

