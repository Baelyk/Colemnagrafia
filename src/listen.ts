import { DEBUG, type Game, main } from "./main";
import { submitWord } from "./puzzle";
import { resizeCanvas } from "./utils";

export function listen(game: Game) {
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
			game.puzzle.word = game.puzzle.word.substring(
				0,
				game.puzzle.word.length - 1,
			);
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
	window
		.matchMedia("(prefers-color-scheme: dark)")
		.addEventListener("change", (event) => {
			if (DEBUG.eventLogging) console.log("prefers-color-scheme");
			game.darkMode = event.matches;
			document.documentElement.style.removeProperty("background-color");

			window.requestAnimationFrame((time) => main(time, game));
		});
}
