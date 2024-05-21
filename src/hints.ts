import { Interaction, interacted, interacting } from "./listen";
import { type Game, main } from "./main";
import {
	COLORS,
	FONTS,
	SIZES,
	getTextHeight,
	scrolling,
	wrapText,
} from "./utils";

export function hints(
	_time: DOMHighResTimeStamp,
	game: Game,
	menuBarY: number,
	menuBarPadding: number,
	menuHeight: number,
	menuX: number,
) {
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
	if (interacting(game, Interaction.Down)) {
		interacted(game);
		game.hintsOpen = !game.hintsOpen;

		window.requestAnimationFrame((time) => main(time, game));
	}

	game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.word}`;
	game.ctx.textAlign = "center";
	game.ctx.textBaseline = "middle";
	game.ctx.fillStyle = COLORS.fg(game);
	game.ctx.fillText("?", hintsX + menuHeight / 2, hintsY + menuHeight / 2);

	if (game.hintsOpen) {
		const hintsX = game.panes != null ? game.panes.rightX : 0;
		const hintsPadding = game.panes != null ? SIZES.tiny(game) : menuBarPadding;
		const hintsWidth =
			game.panes != null ? game.panes.width - 2 * SIZES.tiny(game) : game.width;
		let hintsY = game.panes != null ? 4 * SIZES.small(game) : SIZES.teeny(game);
		const hintsHeight =
			game.panes != null
				? game.height - hintsY - SIZES.small(game)
				: game.height;

		game.ctx.fillStyle = COLORS.fg(game);
		game.ctx.textAlign = "left";
		game.ctx.textBaseline = "top";
		const hintsHeader = "hints";
		game.ctx.font = `bold ${SIZES.medium(game)}px ${FONTS.word}`;
		game.ctx.fillText(game.lang.hints.title, hintsX + hintsPadding, hintsY);
		hintsY += getTextHeight(game.ctx, hintsHeader);

		// Clip to only display text inside the wordlist
		game.ctx.beginPath();
		game.ctx.rect(hintsX, hintsY, hintsWidth, hintsHeight);
		game.ctx.save();
		game.ctx.clip();

		hintsY += SIZES.small(game);

		const hintsMaxScroll = Math.max(0, game.hintsHeight - game.height);
		[game.hintsScroll, game.hintsScrollSpeed] = scrolling(
			game,
			game.hintsScroll,
			game.hintsScrollSpeed,
			game.hintsUserIsScrolling,
			hintsMaxScroll,
		);
		hintsY -= game.hintsScroll;

		const hintsPangramText = game.lang.hints.pangrams(
			game.hintsPuzzle.pangrams,
			game.hintsFound.pangrams,
		);
		game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
		const hintsPangramTextHeight = wrapText(
			game.ctx,
			hintsPangramText,
			hintsX + hintsPadding,
			hintsY,
			hintsWidth,
		);
		hintsY += hintsPangramTextHeight + SIZES.small(game);

		const cellSize = SIZES.medium(game);

		game.ctx.fillStyle = COLORS.fg(game);
		game.ctx.textAlign = "left";
		game.ctx.textBaseline = "top";
		const remainingWordsHeader = game.lang.hints.remainingWords;
		game.ctx.font = `bold ${SIZES.small(game)}px ${FONTS.word}`;
		game.ctx.fillText(remainingWordsHeader, hintsX + hintsPadding, hintsY);
		hintsY +=
			getTextHeight(game.ctx, remainingWordsHeader) -
			cellSize / 2 +
			SIZES.teeny(game);

		const tableY = hintsY;
		game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.word}`;
		game.ctx.textAlign = "center";
		game.ctx.textBaseline = "middle";
		const letters = [...game.puzzle.letters].sort();

		game.ctx.lineWidth = 2;
		game.ctx.strokeStyle = COLORS.gray(game);
		game.ctx.fillStyle = COLORS.fg(game);
		game.ctx.beginPath();

		const lengthsSet: Set<number> = new Set();
		for (const letterLengthList of Array.from(
			game.hintsPuzzle.lengths.values(),
		)) {
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
		if (game.pointerDown != null && game.hintsTableUserIsScrolling) {
			game.ctx.beginPath();
			game.ctx.rect(0, tableY, tableWidth, tableHeight);
			if (!interacting(game, Interaction.Hover)) {
				// Pointer isn't inside the table, so don't scroll table
				game.hintsTableUserIsScrolling = false;
			}
		}

		const hintsTableMaxScroll = Math.max(0, tableWidth - hintsWidth);
		[game.hintsTableScroll, game.hintsTableScrollSpeed] = scrolling(
			game,
			game.hintsTableScroll,
			game.hintsTableScrollSpeed,
			game.hintsTableUserIsScrolling,
			hintsTableMaxScroll,
		);

		const tableX = hintsX + SIZES.small(game) - game.hintsTableScroll;
		game.ctx.textBaseline = "top";
		for (let j = 0; j < lengths.length; j++) {
			game.ctx.fillText(
				lengths[j].toString(),
				tableX + cellSize / 2 + cellSize * (j + 1),
				tableY + cellSize / 2,
			);
		}
		game.ctx.fillText(
			game.lang.hints.totalAbbreviation,
			tableX + cellSize / 2 + cellSize * (lengths.length + 1),
			tableY + cellSize / 2,
		);
		game.ctx.beginPath();
		game.ctx.moveTo(tableX, tableY + cellSize);
		game.ctx.lineTo(
			tableX + (lengths.length + 2) * cellSize,
			tableY + cellSize,
		);
		game.ctx.stroke();
		game.ctx.textBaseline = "middle";
		let interactingWithBox: { letter: string; count: number } | null = null;
		for (let i = 0; i < 7; i++) {
			const letter = letters[i].toLowerCase();
			game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.word}`;
			game.ctx.fillText(
				letter.toUpperCase(),
				tableX + cellSize / 2,
				tableY + cellSize / 2 + cellSize * (i + 1),
			);

			const puzzleLengths = game.hintsPuzzle.lengths.get(letter) ?? [];
			const foundLengths = game.hintsFound.lengths.get(letter) ?? [];
			game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.word}`;
			lengths.forEach((length, j) => {
				const count = puzzleLengths[length] - (foundLengths[length] ?? 0);
				lengthsTotals[j] += count;
				if (count > 0) {
					game.ctx.beginPath();
					game.ctx.roundRect(
						tableX + 1 + cellSize * (j + 1),
						tableY + 2 + cellSize * (i + 1),
						cellSize - 2,
						cellSize - 4,
						SIZES.teeny(game),
					);
					// Detect interaction
					if (interacting(game, Interaction.Hover)) {
						interactingWithBox = { letter, count };
						game.ctx.fillStyle = COLORS.darkyellow(game);
					} else {
						game.ctx.fillStyle = COLORS.yellow(game);
					}
					game.ctx.fill();
					game.ctx.fillStyle = COLORS.fg(game);
					game.ctx.fillText(
						count.toString(),
						tableX + cellSize / 2 + cellSize * (j + 1),
						tableY + cellSize / 2 + cellSize * (i + 1),
					);
				}
			});

			game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.word}`;
			const total =
				puzzleLengths.reduce((sum, c) => sum + c, 0) -
				foundLengths.reduce((sum, c) => sum + c, 0);
			game.ctx.fillText(
				(total || "").toString(),
				tableX + cellSize / 2 + cellSize * (lengths.length + 1),
				tableY + cellSize / 2 + cellSize * (i + 1),
			);

			game.ctx.beginPath();
			game.ctx.moveTo(tableX, tableY + cellSize * (i + 2));
			game.ctx.lineTo(
				tableX + (lengths.length + 2) * cellSize,
				tableY + cellSize * (i + 2),
			);
			game.ctx.stroke();
		}
		game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.word}`;
		for (let j = -1; j < lengths.length; j++) {
			game.ctx.fillText(
				(j === -1
					? game.lang.hints.totalAbbreviation
					: lengthsTotals[j] || ""
				).toString(),
				tableX + cellSize / 2 + cellSize * (j + 1),
				tableY + cellSize / 2 + cellSize * (letters.length + 1),
			);
		}
		const total = lengthsTotals.reduce((sum, c) => sum + c, 0);
		game.ctx.fillText(
			(total || "").toString(),
			tableX + cellSize / 2 + cellSize * (lengths.length + 1),
			tableY + cellSize / 2 + cellSize * (letters.length + 1),
		);
		game.ctx.beginPath();
		game.ctx.moveTo(tableX, tableY + cellSize * (letters.length + 2));
		game.ctx.lineTo(
			tableX + (lengths.length + 2) * cellSize,
			tableY + cellSize * (letters.length + 2),
		);
		game.ctx.stroke();

		hintsY += tableHeight + SIZES.small(game);

		game.ctx.fillStyle = COLORS.fg(game);
		game.ctx.textAlign = "left";
		game.ctx.textBaseline = "top";
		const remainingStartsHeader = game.lang.hints.remainingStarts;
		game.ctx.font = `bold ${SIZES.small(game)}px ${FONTS.word}`;
		game.ctx.fillText(remainingStartsHeader, hintsX + hintsPadding, hintsY);
		hintsY +=
			getTextHeight(game.ctx, remainingStartsHeader) + SIZES.teeny(game);

		game.ctx.textAlign = "center";
		game.ctx.textBaseline = "middle";
		const startsX = hintsX + SIZES.small(game);
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
			const lineWidth = cellSize * (j + 2);
			if (lineWidth > hintsWidth - SIZES.small(game)) {
				hintsY += cellSize + SIZES.tiny(game);
				j = 0;
			}

			// Gray border unifying the start and the count
			game.ctx.beginPath();
			game.ctx.moveTo(
				startsX + SIZES.teeny(game) + cellSize * j,
				hintsY + cellSize,
			);
			game.ctx.lineTo(startsX + cellSize * (j + 2), hintsY + cellSize);
			game.ctx.strokeStyle = COLORS.gray(game);
			game.ctx.stroke();
			// Display the start
			game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.word}`;
			game.ctx.fillText(
				start.toUpperCase(),
				startsX + cellSize / 2 + cellSize * j,
				hintsY + cellSize / 2,
			);
			// Display the count in the an interactive yellow box
			game.ctx.beginPath();
			game.ctx.roundRect(
				startsX + 1 + cellSize * (j + 1),
				hintsY + 2,
				cellSize - 2,
				cellSize - 4,
				SIZES.teeny(game),
			);
			// Detect interaction
			if (interacting(game, Interaction.Hover)) {
				interactingWithBox = { letter: start, count };
				game.ctx.fillStyle = COLORS.darkyellow(game);
			} else {
				game.ctx.fillStyle = COLORS.yellow(game);
			}
			game.ctx.fill();
			game.ctx.fillStyle = COLORS.fg(game);
			game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.word}`;
			game.ctx.fillText(
				count.toString(),
				startsX + cellSize / 2 + cellSize * (j + 1),
				hintsY + cellSize / 2,
			);

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
			const interactiveWidth = hintsWidth - 2 * SIZES.big(game);
			const interactiveX = hintsX + hintsWidth / 2 - interactiveWidth / 2;

			game.ctx.beginPath();
			game.ctx.roundRect(
				interactiveX,
				interactiveY,
				interactiveWidth,
				interactiveHeight,
				SIZES.teeny(game),
			);
			game.ctx.fillStyle = COLORS.bg(game);
			game.ctx.strokeStyle = COLORS.fg(game);
			game.ctx.lineWidth = 1;
			game.ctx.fill();
			game.ctx.stroke();

			const { letter, count } = interactingWithBox;
			const tooltipText = game.lang.hints.tooltip(letter, count);

			game.ctx.fillStyle = COLORS.fg(game);
			game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
			game.ctx.textAlign = "center";
			game.ctx.textBaseline = "bottom";
			wrapText(
				game.ctx,
				tooltipText,
				hintsX + hintsWidth / 2,
				interactiveY + interactiveHeight / 2,
				interactiveWidth - SIZES.big(game),
			);
		}

		// Restore to remove clipping
		game.ctx.restore();
	}
}
