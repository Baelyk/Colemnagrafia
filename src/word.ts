import type { Game } from "./main";
import { COLORS, FONTS, SIZES } from "./utils";

export function word(_time: DOMHighResTimeStamp, game: Game) {
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
		game.ctx.fillStyle =
			letter === game.puzzle.letters[0] ? COLORS.yellow(game) : COLORS.fg(game);
		game.ctx.fillText(letter, letterX, wordY);
		letterX += game.ctx.measureText(letter).width;
	}
}
