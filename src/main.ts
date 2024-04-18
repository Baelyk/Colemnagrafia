import { invoke } from "@tauri-apps/api/core";

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

const SIZES = {
  smallestDimension: (game: Game) => Math.min(game.height, game.width),
  big: (game: Game) => SIZES.smallestDimension(game) / 7,
  medium: (game: Game) => SIZES.smallestDimension(game) / 10,
  small: (game: Game) => SIZES.smallestDimension(game) / 15,
  tiny: (game: Game) => SIZES.smallestDimension(game) / 25,
  teeny: (game: Game) => SIZES.smallestDimension(game) / 90,
}

type WordMap = { [key: string]: string[] };


interface Game {
  width: number;
  height: number;
  ctx: CanvasRenderingContext2D;

  errorText: string | null;

  puzzle_promise: Promise<unknown>;
  letters: string[];
  words: WordMap;
  pangrams: Set<string>;
  maxScore: number;
  word: string;
  found: string[];
  score: number;

  mouseX: number;
  mouseY: number;
  mouseDown: boolean;

  clickedHex: number | null;
  clickedHexTime: DOMHighResTimeStamp | null;

  wordMessage: string | null;

  wordlistIsOpen: boolean;
  wordlistToggleTime: DOMHighResTimeStamp | null;
  wordlistScroll: number;
}

type NewPuzzleResponse = [string[], WordMap, string[]];

window.addEventListener("DOMContentLoaded", () => {
  const game = init();
  if (game == null) {
    console.error("Error initializing game");
    return;
  }

  game.puzzle_promise.then(msg => {
    const message = msg as NewPuzzleResponse;

    console.debug(message);

    game.letters = message[0].map(l => l.toUpperCase());
    game.words = message[1];
    game.pangrams = new Set(message[2]);
    game.maxScore = Object.values(game.words).flat().reduce(
      (sum, word) => sum + scoreWord(word, game), 0);

    // For debugging, log the game
    console.debug(game);

    if (DEBUG.foundAllWords) {
      game.found = Object.values(game.words).flat();
    }
  }).catch(message => {
    console.error("Puzzle generation failed");
    console.debug(message);
    game.errorText = JSON.stringify(message);
  });

  window.addEventListener("click", (event) => {
    if (DEBUG.eventLogging) console.log("click");
    game.mouseX = event.clientX;
    game.mouseY = event.clientY;
    game.mouseDown = true;
    game.wordMessage = null;
    window.requestAnimationFrame((time) => main(time, game));
  });

  window.addEventListener("mousemove", (event) => {
    if (DEBUG.eventLogging) console.log("mouse");
    game.mouseX = event.clientX;
    game.mouseY = event.clientY;
    game.mouseDown = false;
    window.requestAnimationFrame((time) => main(time, game));
  });

  window.addEventListener("resize", () => {
    if (DEBUG.eventLogging) console.log("resize");
    const width = window.innerWidth;
    const height = window.innerHeight;
    game.ctx.canvas.width = width;
    game.ctx.canvas.height = height;
    game.width = width;
    game.height = height;

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
    window.requestAnimationFrame((time) => main(time, game));
  });

  window.requestAnimationFrame((time) => main(time, game));
});

function init(): Game | undefined {
  console.log("Initializing...");
  const canvas = document.querySelector("canvas");
  if (canvas == null) {
    console.error("Unable to get canvas");
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (ctx == null) {
    console.error("Unable to get canvas context");
    return;
  }

  const letters: string[] = [];
  const words = {};
  const pangrams: Set<string> = new Set();

  const puzzle_promise = invoke("new_puzzle");

  return {
    width,
    height,
    ctx,

    errorText: null,

    puzzle_promise,
    letters,
    words,
    pangrams,
    maxScore: 0,
    word: "",
    found: [],
    score: 0,

    mouseX: -1,
    mouseY: -1,
    mouseDown: false,

    clickedHex: null,
    clickedHexTime: null,

    wordMessage: null,

    wordlistIsOpen: false,
    wordlistToggleTime: null,
    wordlistScroll: 0,
  };
}

function main(time: DOMHighResTimeStamp, game: Game) {
  game.ctx.clearRect(0, 0, game.width, game.height);

  if (game.errorText != null) {
    error(time, game);
    return;
  }

  if (game.letters.length === 0) {
    loading(time, game);
    return;
  }

  const clicked = wheel(time, game);
  game.word += clicked;
  if (clicked) {
    console.log(game.word);
  }

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
  game.ctx.font = `${SIZES.small(game)}px ${FONTS.default}`;
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
  if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.clickedHex = 0;
      game.clickedHexTime = time;
      clicked = game.letters[0];
      game.ctx.fillStyle = COLORS.darkyellow;
    } else {
      game.ctx.fillStyle = COLORS.darkyellow;
    }
  } else {
    game.ctx.fillStyle = COLORS.yellow;
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
  game.ctx.fillText(game.letters[0], centerX, centerY);

  // Surrounding hexagons
  const radians = 2 * Math.PI / 6;
  const radius = 1.9 * hexRadius;
  for (let i = 1; i <= 6; i++) {
    const x = centerX + Math.cos(radians * i + radians / 2) * radius;
    const y = centerY + Math.sin(radians * i + radians / 2) * radius;
    hexagon(game.ctx, x, y, hexRadius);
    if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
      if (game.mouseDown) {
        game.mouseDown = false;
        game.clickedHex = i;
        game.clickedHexTime = time;
        clicked = game.letters[i];
        game.ctx.fillStyle = COLORS.darkgray;
      } else {
        game.ctx.fillStyle = COLORS.darkgray;
      }
    } else {
      game.ctx.fillStyle = COLORS.gray;
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
    game.ctx.fillText(game.letters[i], x, y);
  }

  return clicked;
}

function word(_time: DOMHighResTimeStamp, game: Game) {
  let size = SIZES.medium(game);
  game.ctx.font = `bold ${size}px ${FONTS.word}`;
  game.ctx.textAlign = "center";
  game.ctx.textBaseline = "middle";
  game.ctx.fillStyle = COLORS.black;
  while (game.ctx.measureText(game.word).width > game.width * 0.75) {
    size = size * 0.95;
    game.ctx.font = `bold ${size}px ${FONTS.word}`;
  }

  const wordY = game.height - SIZES.big(game) * 8;

  let text = game.word;
  if (game.wordMessage != null) {
    text = game.wordMessage;
    game.ctx.fillStyle = COLORS.darkgray;
  }
  game.ctx.fillText(text, game.width / 2, wordY);
}

function controls(_time: DOMHighResTimeStamp, game: Game) {
  const controlY = game.height - SIZES.big(game);
  const controlRadius = SIZES.small(game);
  game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
  game.ctx.textAlign = "center";
  game.ctx.textBaseline = "middle";

  // Delete
  const deleteX = game.width / 2 - controlRadius * 4;
  game.ctx.beginPath();
  game.ctx.arc(deleteX - controlRadius, controlY, controlRadius, Math.PI / 2, Math.PI * 3 / 2)
  game.ctx.arc(deleteX + controlRadius, controlY, controlRadius, Math.PI * 3 / 2, Math.PI / 2)
  game.ctx.closePath();
  if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.ctx.fillStyle = COLORS.darkgray;
      game.word = game.word.substring(0, game.word.length - 1);
      window.requestAnimationFrame((time) => main(time, game));
    } else {
      game.ctx.fillStyle = COLORS.gray;
    }
  } else {
    game.ctx.fillStyle = COLORS.white;
  }
  game.ctx.lineWidth = 1;
  game.ctx.stroke();
  game.ctx.fill();
  game.ctx.fillStyle = COLORS.black;
  game.ctx.fillText("Delete", deleteX, controlY);

  // Shuffle
  game.ctx.beginPath();
  game.ctx.arc(game.width / 2, controlY, controlRadius, 0, 2 * Math.PI)
  if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.ctx.fillStyle = COLORS.darkgray;
      game.letters = game.letters
        .map((letter, i) => ({ letter, sort: i === 0 ? 0 : Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ letter }) => letter);
      window.requestAnimationFrame((time) => main(time, game));
    } else {
      game.ctx.fillStyle = COLORS.gray;
    }
  } else {
    game.ctx.fillStyle = COLORS.white;
  }
  game.ctx.lineWidth = 1;
  game.ctx.stroke();
  game.ctx.fill();

  // Enter
  const enterX = game.width / 2 + controlRadius * 4;
  game.ctx.beginPath();
  game.ctx.arc(enterX - controlRadius, controlY, controlRadius, Math.PI / 2, Math.PI * 3 / 2)
  game.ctx.arc(enterX + controlRadius, controlY, controlRadius, Math.PI * 3 / 2, Math.PI / 2)
  game.ctx.closePath();
  if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.ctx.fillStyle = COLORS.darkgray;

      game.word = game.word.toLowerCase();
      if (Object.hasOwn(game.words, game.word)) {
        if (game.found.includes(game.word)) {
          game.wordMessage = "Already found";
        } else {
          let count = 0;
          let score = 0;
          for (const word of game.words[game.word]) {
            game.found.unshift(word);
            score += scoreWord(word, game);
            count += 1;
          }
          game.score += score;
          game.wordMessage = `+${score / count}${count > 1 ? ` x${count}` : ""}`;
        }
      } else if (DEBUG.allowAnyWord) {
        game.found.unshift(game.word);
        const score = scoreWord(game.word, game);
        game.score += score;
        game.wordMessage = `+${score} !`;
      } else {
        if (game.word.length < 4) {
          game.wordMessage = "Too short";
        } else {
          game.wordMessage = "Not a word";
        }

        if (DEBUG.allowAnyWord) {
          game.found.unshift(game.word);
        }
      }
      game.word = "";

      window.requestAnimationFrame((time) => main(time, game));
    } else {
      game.ctx.fillStyle = COLORS.gray;
    }
  } else {
    game.ctx.fillStyle = COLORS.white;
  }
  game.ctx.lineWidth = 1;
  game.ctx.stroke();
  game.ctx.fill();
  game.ctx.fillStyle = COLORS.black;
  game.ctx.fillText("Enter", enterX, controlY);
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
    ([minScore, _]) => game.score < Math.round(minScore * game.maxScore)) - 1;

  const scorebarWidth = game.width * 0.8;
  const scorebarX = game.width / 2 - scorebarWidth / 2;
  const scorebarY = game.height / 10;
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
      game.ctx.fillText(Math.round(game.maxScore * SCORERANKS[i][0]).toString(), tickX, scorebarY);
      // Change rank to this tick's rank while interacting
      displayRank = SCORERANKS[i][1];
    } else if (i === rank) {
      // Display current score if this is the current rank
      game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.word}`;
      game.ctx.fillText(game.score.toString(), tickX, scorebarY);
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
  const wordlistWidth = game.width * 0.8;
  const wordlistHeight = game.wordlistIsOpen ? game.height * 0.7 : game.height / 20;
  const wordlistX = game.width / 2 - wordlistWidth / 2;
  const wordlistY = 2 * game.height / 10;

  game.ctx.beginPath();
  game.ctx.rect(wordlistX, wordlistY, wordlistWidth, wordlistHeight);
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

    const textHeight = game.ctx.measureText("A").fontBoundingBoxAscent
      + game.ctx.measureText("A").fontBoundingBoxDescent;

    // Restrict scrolling
    const rows = Math.ceil(game.found.length / 2) + 1;
    // No need to scroll up
    game.wordlistScroll = Math.min(Math.max(0, game.wordlistScroll),
      // No need to bring the end of the list above the bottom
      Math.max(0, (rows + 1) * textHeight - wordlistHeight));

    game.ctx.fillStyle = COLORS.black;

    const textY = wordlistY + textHeight - game.wordlistScroll;
    const leftX = wordlistX + wordlistWidth / 20;
    const rightX = wordlistX + wordlistWidth / 2 + wordlistWidth / 20;
    let count = 0;
    const alphabetical = [...game.found].sort();
    game.ctx.fillText(`${game.found.length} word${count === 1 ? "" : "s"} found`, leftX, textY);

    for (const word of alphabetical) {
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
  }

  // Wordlist preview
  if (!game.wordlistIsOpen) {
    let preview = "";
    for (const word of game.found) {
      const nextPreview = `${preview}${word} `;
      if (game.ctx.measureText(nextPreview).width > wordlistWidth * 0.9) {
        break;
      }

      preview = nextPreview;
    }
    game.ctx.fillStyle = COLORS.black;
    game.ctx.fillText(preview, wordlistX + wordlistWidth / 20, wordlistY + wordlistHeight / 2);
  }

}

function isPangram(word: string, game: Game): boolean {
  return game.pangrams.has(word);
}

function scoreWord(word: string, game: Game): number {
  return word.length + (isPangram(word, game) ? 7 : 0);
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
