import { main, type Game } from "./main";

/**
 * Resizes the canvas to the specified height and width, and returns the the scaling and scaled dimensions.
 */
export function resizeCanvas(
	gameOrCanvas: Game | HTMLCanvasElement,
	width: number,
	height: number,
): { scaling: number; width: number; height: number } {
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
		height,
	};
}

export interface HasDarkMode {
	darkMode: boolean;
}
export const COLORS = {
	fg: ({ darkMode }: HasDarkMode) => (darkMode ? "white" : "black"),
	bg: ({ darkMode }: HasDarkMode) => (darkMode ? "black" : "white"),
	yellow: ({ darkMode }: HasDarkMode) => (darkMode ? "goldenrod" : "gold"),
	darkyellow: ({ darkMode }: HasDarkMode) => (darkMode ? "gold" : "goldenrod"),
	gray: ({ darkMode }: HasDarkMode) => (darkMode ? "gray" : "lightgray"),
	darkgray: ({ darkMode }: HasDarkMode) => (darkMode ? "darkgray" : "darkgray"),
	red: ({ darkMode }: HasDarkMode) => (darkMode ? "red" : "red"),
};

export const FONTS = {
	default: "sans-serif",
	word: "JetBrains Mono, sans-serif",
};

export interface HasSize {
	width: number;
	height: number;
}
export const SIZES = {
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
};

/**
 * Whether or not word is in the list of pangrams
 */
export function isPangram(word: string, pangrams: string[]): boolean {
	return pangrams.includes(word);
}

/**
 * Returns the score of this word, 4-letter words are worth 1, and otherwise it's 1 pointer per letter and +7 for pangrams.
 */
export function scoreWord(word: string, pangrams: string[]): number {
	if (word.length === 4) {
		return 1;
	}

	return word.length + (isPangram(word, pangrams) ? 7 : 0);
}

/**
 * Path a hexagon centered at x, y with specified radius. Rotated to have a side
 * at the top and bottom, and a vertex at the left and right. Does not draw!
 */
export function hexagon(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
) {
	const sides = 6;
	const radians = (2 * Math.PI) / sides;

	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	for (let i = 1; i <= sides; i++) {
		ctx.lineTo(
			x + Math.cos(radians * i) * radius,
			y + Math.sin(radians * i) * radius,
		);
	}
}

/**
 * Gets the height of the text as it would be rendered on the Canvas.
 */
export function getTextHeight(
	ctx: CanvasRenderingContext2D,
	text: string,
): number {
	return (
		ctx.measureText(text).fontBoundingBoxAscent +
		ctx.measureText(text).fontBoundingBoxDescent
	);
}

export function wrapText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	width: number,
): number {
	let height = 0;
	let line = "";
	const words = text.split(" ");
	for (const word of words) {
		// Add words to the line as long as the result fits within the width
		if (
			ctx.measureText(line).width + ctx.measureText(`${word} `).width <=
			width
		) {
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
 * Shrink the font size so that the text fits within the specified width.
 * @param ctx the Canvas 2D context
 * @param text the text to fit
 * @param width the maximum width to fit the text in
 * @param startingFont the CSS font specifier for the text
 * @returns the modified CSS font specifier with a fontsize that will fit
 */
export function shrinkFontSizeToFit(
	ctx: CanvasRenderingContext2D,
	text: string,
	width: number,
	startingFont: string,
): string {
	// Regex match to extract the fontsize and descriptors before and after
	const regexMatch = /([\d,.]+)px/d.exec(startingFont);
	if (regexMatch == null || regexMatch.indices == null) {
		console.error("Unable to identify fontsize to shrink");
		return startingFont;
	}
	const startingFontSize = regexMatch[1];
	const before = startingFont.substring(0, regexMatch.indices[1][0]);
	const after = startingFont.substring(regexMatch.indices[1][1]);
	let fontsize = Number(startingFontSize);

	// Loop to slowly reduce the fontsize to fit, save and restore to preserve settings
	ctx.save();
	let font = `${before}${fontsize}${after}`;
	ctx.font = font;
	while (ctx.measureText(text).width > width) {
		fontsize *= 0.99;
		font = `${before}${fontsize}${after}`;
		ctx.font = font;
	}
	ctx.restore();

	return font;
}

export function removeAccents(str: string): string {
	return str.normalize("NFD").replace(/\p{Diacritic}/gu, "");
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
export function scrolling(
	game: Game,
	scroll: number,
	scrollDelta: number,
	scrollSpeed: number,
	userIsScrolling: boolean,
	maximumScroll: number,
): [number, number] {
	let newScroll = scroll;
	// Set the newScrollSpeed to the amount scrolled by the pointer since the last
	// frame if the user is scrolling, otherwise set it to the old scrollSpeed
	let newScrollSpeed = userIsScrolling ? scrollDelta : scrollSpeed;

	// No inertia when scrolling with the wheel, so bypass speed and manually update
	// scroll
	if (userIsScrolling && game.pointerScrollIsWheel) {
		newScrollSpeed = 0;
		newScroll += scrollDelta;
	}

	if (userIsScrolling) {
		// Scrolling by user
		newScroll += newScrollSpeed;
	} else if (newScrollSpeed !== 0) {
		// Scrolling by inertia
		// The user is not currently scrolling and scroll speed is positive, i.e. scrolling via "inertia"
		newScroll += newScrollSpeed;
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
	} else if (newScroll > maximumScroll) {
		// No need to bring the end of the list above the bottom
		newScroll = maximumScroll;
		newScrollSpeed = 0;
	}

	return [newScroll, newScrollSpeed];
}
