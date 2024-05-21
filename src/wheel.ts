import { Interaction, interacted, interacting } from "./listen";
import { type Game, main } from "./main";
import { COLORS, FONTS, SIZES, hexagon } from "./utils";

/**
 * Draw the hexagon letter wheel
 */
export function wheel(time: DOMHighResTimeStamp, game: Game) {
	let clicked = "";
	const hexRadius = SIZES.big(game);

	game.ctx.font = `bold ${hexRadius}px ${FONTS.word}`;
	game.ctx.textAlign = "center";
	game.ctx.textBaseline = "middle";

	// Center hexagon
	let centerX = game.width / 2;
	if (game.panes != null) {
		centerX = game.panes.leftX + game.panes.width / 2;
	}
	const centerY = game.height - hexRadius * 4.5;
	hexagon(game.ctx, centerX, centerY, hexRadius);
	game.ctx.fillStyle = COLORS.yellow(game);
	if (interacting(game, Interaction.Down)) {
		interacted(game);
		game.clickedHex = 0;
		game.clickedHexTime = time;
		clicked = game.puzzle.letters[0];
		game.ctx.fillStyle = COLORS.darkyellow(game);
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
	const radians = (2 * Math.PI) / 6;
	const radius = 1.9 * hexRadius;
	for (let i = 1; i <= 6; i++) {
		const x = centerX + Math.cos(radians * i + radians / 2) * radius;
		const y = centerY + Math.sin(radians * i + radians / 2) * radius;
		hexagon(game.ctx, x, y, hexRadius);
		game.ctx.fillStyle = COLORS.gray(game);
		if (interacting(game, Interaction.Down)) {
			interacted(game);
			game.clickedHex = i;
			game.clickedHexTime = time;
			clicked = game.puzzle.letters[i];
			game.ctx.fillStyle = COLORS.darkgray(game);
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
