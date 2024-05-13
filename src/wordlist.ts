import { Interaction, interacted, interacting } from "./listen";
import { type Game, main } from "./main";
import { COLORS, FONTS, SIZES, getTextHeight, scrolling } from "./utils";

export function wordlist(_time: DOMHighResTimeStamp, game: Game) {
	const wordlistWidth = game.width - 2 * SIZES.tiny(game);
	const wordlistX = game.width / 2 - wordlistWidth / 2;
	const wordlistY = 4 * SIZES.small(game);
	const wordlistHeight = game.wordlistIsOpen
		? game.height - wordlistY - SIZES.small(game)
		: game.height / 20;

	game.ctx.beginPath();
	game.ctx.roundRect(
		wordlistX,
		wordlistY,
		wordlistWidth,
		wordlistHeight,
		SIZES.teeny(game),
	);
	game.ctx.strokeStyle = game.revealAnswers
		? COLORS.yellow(game)
		: COLORS.fg(game);
	game.ctx.fillStyle = COLORS.bg(game);
	game.ctx.fill();
	game.ctx.stroke();

	if (interacting(game, Interaction.Up)) {
		interacted(game);
		game.wordlistIsOpen = !game.wordlistIsOpen;
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
		const textHeight = getTextHeight(game.ctx, "A") * 2;

		// Get the wordlist and sort it alphabetically
		let list = [...game.puzzle.found];
		if (game.revealAnswers) {
			// Revealing answers, so show all words
			list = Object.values(game.puzzle.lemmas).flat();
		}
		list.sort((a, b) => a.localeCompare(b));

		// Restrict scrolling
		const rows = Math.ceil(list.length / 2) + 1;
		const wordlistInnerHeight = (rows + 1) * textHeight - wordlistHeight;
		const wordlistMaxScroll = Math.max(0, wordlistInnerHeight);
		[game.wordlistScroll, game.wordlistScrollSpeed] = scrolling(
			game,
			game.wordlistScroll,
			game.wordlistScrollSpeed,
			game.wordlistUserIsScrolling,
			wordlistMaxScroll,
		);

		game.ctx.fillStyle = COLORS.fg(game);

		const textY = wordlistY + textHeight - game.wordlistScroll;
		const leftX = wordlistX + SIZES.tiny(game);
		const rightX = wordlistX + wordlistWidth / 2 + SIZES.tiny(game);
		let count = 0;
		game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
		game.ctx.fillText(
			`${game.puzzle.found.length} word${count === 1 ? "" : "s"} found`,
			leftX,
			textY,
		);

		for (const word of list) {
			const italics = game.puzzle.justFound.includes(word) ? "italic" : "";
			const weight = game.puzzle.pangrams.includes(word) ? "bold" : "";
			game.ctx.font = `${italics} ${weight} ${SIZES.tiny(game)}px ${FONTS.default
				}`;
			game.ctx.fillStyle = game.puzzle.found.includes(word)
				? COLORS.fg(game)
				: COLORS.yellow(game);
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
		game.ctx.lineTo(
			game.width / 2,
			wordlistY + wordlistHeight - textHeight / 2,
		);
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
			const italics = game.puzzle.justFound.includes(word) ? "italic" : "";
			const weight = game.puzzle.pangrams.includes(word) ? "bold" : "";
			game.ctx.font = `${italics} ${weight} ${SIZES.tiny(game)}px ${FONTS.default
				}`;
			const wordSize = game.ctx.measureText(`${word}`).width;
			if (
				previewSize + wordSize + elipsisSize + padding >
				wordlistWidth - SIZES.tiny(game) * 2
			) {
				game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
				game.ctx.fillText(
					"...",
					textX + previewSize,
					wordlistY + wordlistHeight / 2,
				);
				break;
			}
			game.ctx.fillText(
				word,
				textX + previewSize,
				wordlistY + wordlistHeight / 2,
			);
			previewSize += wordSize + padding;
		}

		// Toggle the wordlist being open when you click on it
		game.ctx.beginPath();
		game.ctx.roundRect(
			wordlistX,
			wordlistY,
			wordlistWidth,
			wordlistHeight,
			SIZES.teeny(game),
		);
	}
}
