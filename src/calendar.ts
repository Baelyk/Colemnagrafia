import { Interaction, interacted, interacting } from "./listen";
import { Game, main } from "./main";
import { Puzzle } from "./puzzle";
import {
	COLORS,
	FONTS,
	SIZES,
	getDaysSinceEpoch,
	triangle,
	wrapText,
} from "./utils";

export function calendar(
	_time: DOMHighResTimeStamp,
	game: Game,
	calendarX: number,
	calendarY: number,
	containerWidth: number,
): number | null {
	const cellSize = SIZES.medium(game);
	const calendarWidth = cellSize * 7;
	const cellPadding = 2;
	game.ctx.lineWidth = 2;

	// Center the calendar in its container
	calendarX += containerWidth / 2 - calendarWidth / 2;

	// Header
	game.ctx.font = `bold ${SIZES.small(game)}px ${FONTS.word}`;
	game.ctx.textAlign = "center";
	game.ctx.textBaseline = "middle";
	game.ctx.fillStyle = COLORS.fg(game);
	const headerHeight = wrapText(
		game.ctx,
		game.lang.calendar.header,
		calendarX + calendarWidth / 2,
		calendarY,
		calendarWidth,
	);
	calendarY += headerHeight;

	// Draw triangles
	game.ctx.beginPath();
	game.ctx.save();
	game.ctx.translate(calendarX + cellSize / 2, calendarY + cellSize / 2);
	game.ctx.rotate(Math.PI);
	triangle(game.ctx, 0, 0, SIZES.teeny(game));
	game.ctx.restore();
	triangle(
		game.ctx,
		calendarX + cellSize / 2 + cellSize * 6,
		calendarY + cellSize / 2,
		SIZES.teeny(game),
	);
	game.ctx.fillStyle = COLORS.fg(game);
	game.ctx.fill();
	// Triangle buttons
	game.ctx.beginPath();
	game.ctx.roundRect(
		calendarX,
		calendarY,
		cellSize,
		cellSize,
		SIZES.teeny(game),
	);
	if (interacting(game, Interaction.Down)) {
		interacted(game);
		// Previous month
		game.calendarDate = new Date(
			game.calendarDate.getFullYear(),
			game.calendarDate.getMonth() - 1,
		);

		window.requestAnimationFrame((time) => main(time, game));
	}
	game.ctx.beginPath();
	game.ctx.roundRect(
		calendarX + cellSize * 6,
		calendarY,
		cellSize,
		cellSize,
		SIZES.teeny(game),
	);
	if (interacting(game, Interaction.Down)) {
		interacted(game);
		// Next month
		game.calendarDate = new Date(
			Date.UTC(
				game.calendarDate.getFullYear(),
				game.calendarDate.getMonth() + 1,
			),
		);

		window.requestAnimationFrame((time) => main(time, game));
	}

	const monthIndex = game.calendarDate.getMonth();
	const year = game.calendarDate.getFullYear();
	const daysInMonth = getDaysInMonth(year, monthIndex);
	const first = new Date(Date.UTC(year, monthIndex));
	const firstWeekday = game.lang.calendar.weekday(first.getDay());
	const weeks = Math.ceil((daysInMonth + firstWeekday) / 7);

	game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.word}`;
	game.ctx.textAlign = "center";
	game.ctx.textBaseline = "middle";

	const today = getDaysSinceEpoch();
	const firstDays = getDaysSinceEpoch(first);

	game.ctx.fillStyle = COLORS.fg(game);
	game.ctx.fillText(
		game.lang.calendar.date(year, monthIndex),
		calendarX + calendarWidth / 2,
		calendarY + cellSize / 2,
	);

	calendarY += cellSize;

	let i = 0;
	let j = firstWeekday;
	let selectedDay = null;
	for (let day = 1; day <= daysInMonth; day++) {
		if (firstDays + day - 1 > today) {
			// Future days cannot be played, should be grayed out
			game.ctx.fillStyle = COLORS.gray(game);
			game.ctx.strokeStyle = COLORS.gray(game);
			game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.word}`;
		} else {
			// Playable days are yellow
			game.ctx.fillStyle = COLORS.yellow(game);
			game.ctx.strokeStyle = COLORS.yellow(game);
			game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.word}`;

			// Today is yellow and bold
			if (firstDays + day - 1 === today) {
				game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.word}`;
			}

			const previousPuzzleStr = window.localStorage.getItem(
				`${firstDays + day - 1}-puzzle`,
			);
			if (previousPuzzleStr != null) {
				try {
					const previousPuzzle = JSON.parse(previousPuzzleStr) as Puzzle;
					if (previousPuzzle.score > 0) {
						// Started puzzles are dark yellow
						game.ctx.fillStyle = COLORS.darkyellow(game);
						game.ctx.strokeStyle = COLORS.darkyellow(game);
					}
					if (previousPuzzle.score === previousPuzzle.maxScore) {
						// Completed puzzles are dark yellow
						game.ctx.strokeStyle = COLORS.fg(game);
						console.log("max score");
					}
				} catch (error) {
					console.error(
						`Error parsing saved puzzle data for ${firstDays + day - 1}`,
					);
					console.error(error);
				}
			}
		}

		game.ctx.beginPath();
		game.ctx.roundRect(
			calendarX + cellPadding + cellSize * j,
			calendarY + cellPadding + cellSize * i,
			cellSize - 2 * cellPadding,
			cellSize - 2 * cellPadding,
			SIZES.teeny(game),
		);
		game.ctx.fill();
		game.ctx.stroke();

		if (interacting(game, Interaction.Down)) {
			interacted(game);
			// Only allow selecting playable games
			if (firstDays + day - 1 <= today) {
				selectedDay = firstDays + day - 1;
			}

			window.requestAnimationFrame((time) => main(time, game));
		}

		game.ctx.fillStyle = COLORS.fg(game);
		game.ctx.fillText(
			day.toString(),
			calendarX + cellSize / 2 + cellSize * j,
			calendarY + cellSize / 2 + cellSize * i,
		);

		// Increment i and j
		j = (j + 1) % 7;
		i = j === 0 ? i + 1 : i;
	}

	calendarY += cellSize * weeks + SIZES.small(game);

	// Legend
	const day = new Date().getDate();
	game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.word}`;

	game.ctx.beginPath();
	game.ctx.roundRect(
		calendarX + cellPadding,
		calendarY + cellPadding,
		cellSize - 2 * cellPadding,
		cellSize - 2 * cellPadding,
		SIZES.teeny(game),
	);
	game.ctx.fillStyle = COLORS.gray(game);
	game.ctx.strokeStyle = COLORS.gray(game);
	game.ctx.fill();
	game.ctx.stroke();
	game.ctx.fillStyle = COLORS.fg(game);
	game.ctx.textAlign = "center";
	game.ctx.fillText(
		day.toString(),
		calendarX + cellSize / 2,
		calendarY + cellSize / 2,
	);
	game.ctx.textAlign = "left";
	game.ctx.fillText(
		game.lang.calendar.unplayable,
		calendarX + cellSize * 1.5,
		calendarY + cellSize / 2,
	);
	calendarY += cellSize;

	game.ctx.beginPath();
	game.ctx.roundRect(
		calendarX + cellPadding,
		calendarY + cellPadding,
		cellSize - 2 * cellPadding,
		cellSize - 2 * cellPadding,
		SIZES.teeny(game),
	);
	game.ctx.fillStyle = COLORS.yellow(game);
	game.ctx.strokeStyle = COLORS.yellow(game);
	game.ctx.fill();
	game.ctx.stroke();
	game.ctx.fillStyle = COLORS.fg(game);
	game.ctx.textAlign = "center";
	game.ctx.fillText(
		day.toString(),
		calendarX + cellSize / 2,
		calendarY + cellSize / 2,
	);
	game.ctx.textAlign = "left";
	game.ctx.fillText(
		game.lang.calendar.playable,
		calendarX + cellSize * 1.5,
		calendarY + cellSize / 2,
	);
	calendarY += cellSize;

	game.ctx.beginPath();
	game.ctx.roundRect(
		calendarX + cellPadding,
		calendarY + cellPadding,
		cellSize - 2 * cellPadding,
		cellSize - 2 * cellPadding,
		SIZES.teeny(game),
	);
	game.ctx.fillStyle = COLORS.yellow(game);
	game.ctx.strokeStyle = COLORS.yellow(game);
	game.ctx.fill();
	game.ctx.stroke();
	game.ctx.fillStyle = COLORS.fg(game);
	game.ctx.textAlign = "center";
	game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.word}`;
	game.ctx.fillText(
		day.toString(),
		calendarX + cellSize / 2,
		calendarY + cellSize / 2,
	);
	game.ctx.textAlign = "left";
	game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.word}`;
	game.ctx.fillText(
		game.lang.calendar.today,
		calendarX + cellSize * 1.5,
		calendarY + cellSize / 2,
	);
	calendarY += cellSize;

	game.ctx.beginPath();
	game.ctx.roundRect(
		calendarX + cellPadding,
		calendarY + cellPadding,
		cellSize - 2 * cellPadding,
		cellSize - 2 * cellPadding,
		SIZES.teeny(game),
	);
	game.ctx.fillStyle = COLORS.darkyellow(game);
	game.ctx.strokeStyle = COLORS.darkyellow(game);
	game.ctx.fill();
	game.ctx.stroke();
	game.ctx.fillStyle = COLORS.fg(game);
	game.ctx.textAlign = "center";
	game.ctx.fillText(
		day.toString(),
		calendarX + cellSize / 2,
		calendarY + cellSize / 2,
	);
	game.ctx.textAlign = "left";
	game.ctx.fillText(
		game.lang.calendar.started,
		calendarX + cellSize * 1.5,
		calendarY + cellSize / 2,
	);
	calendarY += cellSize;

	game.ctx.beginPath();
	game.ctx.roundRect(
		calendarX + cellPadding,
		calendarY + cellPadding,
		cellSize - 2 * cellPadding,
		cellSize - 2 * cellPadding,
		SIZES.teeny(game),
	);
	game.ctx.fillStyle = COLORS.darkyellow(game);
	game.ctx.strokeStyle = COLORS.fg(game);
	game.ctx.fill();
	game.ctx.stroke();
	game.ctx.fillStyle = COLORS.fg(game);
	game.ctx.textAlign = "center";
	game.ctx.fillText(
		day.toString(),
		calendarX + cellSize / 2,
		calendarY + cellSize / 2,
	);
	game.ctx.textAlign = "left";
	game.ctx.fillText(
		game.lang.score.ranks[9],
		calendarX + cellSize * 1.5,
		calendarY + cellSize / 2,
	);
	calendarY += cellSize;

	return selectedDay;
}

function getDaysInMonth(year: number, monthIndex: number): number {
	return new Date(year, monthIndex + 1, 0).getDate();
}
