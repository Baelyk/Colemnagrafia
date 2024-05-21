import { Interaction, interacted, interacting } from "./listen";
import { type Game, main } from "./main";
import { COLORS, FONTS, SIZES, getTextHeight, scrolling } from "./utils";

export function wordlist(_time: DOMHighResTimeStamp, game: Game): boolean {
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

	game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
	game.ctx.textAlign = "left";
	game.ctx.textBaseline = "middle";

	// Wordlist preview
	if (!game.wordlistIsOpen) {
		// Stop scrolling
		game.wordlistScrollSpeed = 0;

		// Check for opening the wordlist
		if (interacting(game, Interaction.Down)) {
			interacted(game);
			game.wordlistIsOpen = true;
			window.requestAnimationFrame((time) => main(time, game));
		}

		let previewSize = 0;
		const textX = wordlistX + SIZES.tiny(game);
		const padding = SIZES.teeny(game);
		game.ctx.fillStyle = COLORS.fg(game);
		game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default} `;
		const elipsisSize = game.ctx.measureText("...").width;
		for (const word of game.puzzle.found) {
			const italics = game.puzzle.justFound.includes(word) ? "italic" : "";
			const weight = game.puzzle.pangrams.includes(word) ? "bold" : "";
			game.ctx.font = `${italics} ${weight} ${SIZES.tiny(game)}px ${
				FONTS.default
			} `;
			const wordSize = game.ctx.measureText(`${word} `).width;
			if (
				previewSize + wordSize + elipsisSize + padding >
				wordlistWidth - SIZES.tiny(game) * 2
			) {
				game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default} `;
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

		return false;
	}

	// Opened wordlist

	// Check for closing the wordlist
	if (interacting(game, Interaction.AnyUp)) {
		interacted(game);
		game.wordlistIsOpen = false;
		window.requestAnimationFrame((time) => main(time, game));
	}

	// Clip to only display text inside the wordlist
	game.ctx.save();
	game.ctx.beginPath();
	const clipPadding = 2;
	game.ctx.roundRect(
		wordlistX + clipPadding,
		wordlistY + clipPadding,
		wordlistWidth - 2 * clipPadding,
		wordlistHeight - 2 * clipPadding,
		SIZES.teeny(game),
	);
	game.ctx.clip();

	let list = [...game.puzzle.found];
	// Sort the entire wordlist now so that each lemma's list is sorted
	list.sort((a, b) => a.localeCompare(b));
	// Maintain a list with just the found forms to be able to say how many
	// unfound forms remain even if revealing answers
	const lemmasFound = new Map<string, string[]>();
	for (const word of list) {
		const lemma = game.puzzle.lemmas[word];
		const forms = lemmasFound.get(lemma);
		if (forms == null) {
			lemmasFound.set(lemma, [word]);
			continue;
		}
		forms.push(word);
	}
	// Get the wordlist and sort it alphabetically
	let lemmas = Array.from(lemmasFound.entries());
	lemmas.sort((a, b) => a[0].localeCompare(b[0]));
	if (game.revealAnswers) {
		// Revealing answers, so show all words
		lemmas = Array.from(Object.entries(game.puzzle.forms));
	}

	// Restrict scrolling
	const wordlistMaxScroll = Math.max(
		0,
		game.wordlistHeight - wordlistHeight + SIZES.small(game),
	);
	[game.wordlistScroll, game.wordlistScrollSpeed] = scrolling(
		game,
		game.wordlistScroll,
		game.wordlistScrollSpeed,
		game.wordlistUserIsScrolling,
		wordlistMaxScroll,
	);

	let textY = wordlistY + SIZES.tiny(game) - game.wordlistScroll;
	const leftX = wordlistX + 2 * SIZES.tiny(game);
	const rightX = wordlistX + wordlistWidth / 2 + 2 * SIZES.tiny(game);
	game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
	game.ctx.textBaseline = "middle";
	game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.default}`;
	game.ctx.fillStyle = COLORS.fg(game);
	game.ctx.fillText(
		game.lang.wordlist.foundCount(game.puzzle.found.length),
		leftX - SIZES.tiny(game),
		textY,
	);

	const textHeight = getTextHeight(game.ctx, "l");
	const rowSpacing = SIZES.teeny(game);

	textY += rowSpacing + textHeight;
	let col = 0;
	for (const [lemma, forms] of lemmas) {
		let lemmaIsForm =
			game.puzzle.forms[lemma].length === 1 &&
			game.puzzle.forms[lemma][0] === lemma;

		if (lemmaIsForm && col > 1) {
			col = 0;
			textY += rowSpacing + textHeight;
		} else if (!lemmaIsForm && col !== 0) {
			col = 0;
			textY += rowSpacing + textHeight;
		}

		game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
		game.ctx.fillStyle = COLORS.fg(game);
		let text = lemma;
		game.ctx.fillStyle = game.puzzle.found.includes(lemma)
			? COLORS.fg(game)
			: COLORS.yellow(game);
		if (!lemmaIsForm) {
			game.ctx.fillStyle = COLORS.darkgray(game);
			const delta =
				game.puzzle.forms[lemma].length - (lemmasFound.get(lemma)?.length ?? 0);
			text = `${lemma}${game.lang.wordlist.lemmaRemaining(delta)}`;

			game.ctx.beginPath();
			game.ctx.roundRect(
				wordlistX + SIZES.tiny(game),
				textY,
				wordlistWidth - SIZES.tiny(game) * 2,
				(textHeight + rowSpacing) / 2 +
					(rowSpacing + textHeight) * Math.ceil(forms.length / 2),
				SIZES.teeny(game),
			);
			game.ctx.strokeStyle = COLORS.gray(game);
			game.ctx.stroke();

			game.ctx.beginPath();
			game.ctx.rect(
				leftX - SIZES.teeny(game),
				textY - textHeight / 2,
				game.ctx.measureText(text).width + SIZES.teeny(game) * 2,
				textHeight,
			);
			game.ctx.fillStyle = COLORS.bg(game);
			game.ctx.fill();

			game.ctx.fillStyle = COLORS.darkgray(game);
		}
		game.ctx.fillText(text, col === 0 ? leftX : rightX, textY);

		if (lemmaIsForm) {
			col++;
			continue;
		}

		// Start new row with this lemma's forms
		textY += rowSpacing + textHeight;
		for (const form of forms) {
			if (col > 1) {
				col = 0;
				textY += rowSpacing + textHeight;
			}
			// Form
			const italics = game.puzzle.justFound.includes(form) ? "italic" : "";
			const weight = game.puzzle.pangrams.includes(form) ? "bold" : "";
			game.ctx.font = `${italics} ${weight} ${SIZES.tiny(game)}px ${
				FONTS.default
			} `;
			game.ctx.fillStyle = game.puzzle.found.includes(form)
				? COLORS.fg(game)
				: COLORS.yellow(game);
			game.ctx.fillText(form, col === 0 ? leftX : rightX, textY);
			col++;
		}
		// The next lemma should start on a new row
		col = 2;
	}

	// Save the height for scroll restriction
	game.wordlistHeight =
		textY -
		(wordlistY + SIZES.tiny(game) - game.wordlistScroll) +
		SIZES.tiny(game);

	// Restore previous clipping
	game.ctx.restore();

	return true;
}
