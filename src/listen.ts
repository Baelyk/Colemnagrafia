import { DEBUG, type Game, main } from "./main";
import { submitWord } from "./puzzle";
import { SIZES, resizeCanvas } from "./utils";

export interface PointerData {
	x: number;
	y: number;
	new: boolean;
}

export enum Interaction {
	/** Interaction for a pointer down anywhere */
	AnyDown = "anydown",
	/** Interaction for a pointer down inside the current path */
	Down = "down",
	/** Interaction for a pointer inside the current path (not necessarily down) */
	Hover = "hover",
	/** Interaction for the pointer Down and then Up anywhere */
	AnyUp = "anyup",
	/** Interaction for the pointer Down and then Up inside the current path */
	Up = "up",
}

/**
 * Return if the pointer is interacting with the current path
 */
export function interacting(game: Game, interaction: Interaction): boolean {
	if (interaction == Interaction.Hover) {
		return game.ctx.isPointInPath(game.pointerX, game.pointerY);
	} else if (
		game.pointerUp != null ||
		interaction === Interaction.Up ||
		interaction === Interaction.AnyUp
	) {
		if (game.pointerDown == null) {
			// Pointer down is null, which means the pointer moved to much, i.e. the
			// user ended up scrolling
			return false;
		}
		if (game.pointerUp == null) {
			// Pointer is not up yet
			return false;
		}
		// If the pointer didn't move much in going Down to Up, this is indeed an
		// Interaction.Up or Interaction.AnyUp
		const pointerDelta = Math.hypot(
			game.pointerUp.x - game.pointerDown.x,
			game.pointerUp.y - game.pointerDown.y,
		);
		if (pointerDelta < SIZES.small(game)) {
			// If this is an Interaction.Up, ensure the down happened inside the path
			if (interaction === Interaction.Up) {
				return game.ctx.isPointInPath(game.pointerDown.x, game.pointerDown.y);
			} else if (interaction === Interaction.AnyUp) {
				return true;
			}
		}

		return false;
	} else if (interaction === Interaction.Down) {
		if (game.pointerDown == null) {
			return false;
		}
		return game.ctx.isPointInPath(game.pointerDown.x, game.pointerDown.y);
	} else if (interaction == Interaction.AnyDown) {
		return game.pointerDown != null;
	}
	console.error(
		"Unknown interaction state",
		game.pointerDown,
		game.pointerUp,
		interaction,
	);
	return false;
}

/**
 * Update the Game object to indicated something has been interacted with, and
 * prevent additional interactions with the same pointer event.
 */
export function interacted(game: Game) {
	game.pointerDown = null;
	game.pointerUp = null;
	game.pointerScrollVertical = 0;
	game.pointerScrollHorizontal = 0;
}

export function isUserScrolling(
	game: Game,
	//scrollDelta: number,
): boolean | null {
	// Check for scrolling, i.e. pointer newly down and in path
	if (
		game.pointerDown?.new &&
		game.ctx.isPointInPath(game.pointerDown.x, game.pointerDown.y)
	) {
		// Pointer drag scrolling
		return true;
	} else if (
		//scrollDelta > 0 &&
		game.pointerScrollIsWheel &&
		game.ctx.isPointInPath(game.pointerX, game.pointerY)
	) {
		// Mouse wheel scrolling
		return true;
	} else if (
		game.pointerUp?.new ||
		game.pointerDown == null ||
		game.pointerScrollIsWheel
	) {
		// Not scrolling
		return false;
	}

	return null;
}

/**
 * Reset pointer state at the end of a tick to clean up missed clicks, remove
 * new status from downs and ups, and reset scrolling state.
 */
export function gobbleMissedInteractions(game: Game) {
	// If the pointer has gone through a down and up cycle without being marked as
	// interacted, mark it as interacted now to reset interaction state.
	if (game.pointerDown != null && game.pointerUp != null) {
		game.pointerDown = null;
		game.pointerUp = null;
	}

	// Remove new from pointerDown/Up
	if (game.pointerDown?.new) {
		game.pointerDown.new = false;
	}
	if (game.pointerUp?.new) {
		game.pointerUp.new = false;
	}

	// Scrolls are always missed
	game.pointerScrollVertical = 0;
	game.pointerScrollHorizontal = 0;
	game.pointerScrollIsWheel = false;
}

export function listen(game: Game) {
	window.addEventListener("pointerdown", (event) => {
		if (DEBUG.eventLogging) console.log("pointerdown");
		// Remove pointerUp and set pointerDown to reset interaction state
		game.pointerUp = null;
		game.pointerDown = {
			x: event.clientX * game.scaling,
			y: event.clientY * game.scaling,
			new: true,
		};
		game.pointerX = event.clientX * game.scaling;
		game.pointerY = event.clientY * game.scaling;

		game.wordMessage = null;

		window.requestAnimationFrame((time) => main(time, game));
	});

	window.addEventListener("resize", () => {
		if (DEBUG.eventLogging) console.log("resize");
		resizeCanvas(game, window.innerWidth, window.innerHeight);

		window.requestAnimationFrame((time) => main(time, game));
	});

	window.addEventListener("wheel", (event) => {
		if (DEBUG.eventLogging) console.log("wheel");

		game.pointerScrollVertical += event.deltaY;
		game.pointerScrollHorizontal += event.deltaX;
		game.pointerScrollIsWheel = true;

		window.requestAnimationFrame((time) => main(time, game));
	});

	window.addEventListener("pointermove", (event) => {
		if (DEBUG.eventLogging) console.log("pointermove");

		// Update the game's pointerX and Y
		game.pointerX = event.clientX * game.scaling;
		game.pointerY = event.clientY * game.scaling;
		window.requestAnimationFrame((time) => main(time, game));

		if (game.pointerDown != null) {
			const pointerDelta = Math.hypot(
				game.pointerX - game.pointerDown.x,
				game.pointerY - game.pointerDown.y,
			);
			// If the pointer has not moved much, it's just jitter, not movement
			if (pointerDelta <= SIZES.tiny(game)) {
				return;
			}
		}

		// Handle scrolling when pointer is a touch or the pointer is down, ignoring
		// e.g. mouse movements
		if (event.pointerType === "touch" || event.pressure >= 0.5) {
			game.pointerScrollVertical -= event.movementY;
			game.pointerScrollHorizontal -= event.movementX;
			game.pointerScrollIsWheel = false;
		}
	});

	window.addEventListener("pointerup", (event) => {
		if (DEBUG.eventLogging) console.log("pointerup");
		// Add pointerUp, but do not remove pointerDown
		game.pointerUp = {
			x: event.clientX * game.scaling,
			y: event.clientY * game.scaling,
			new: true,
		};

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
