import { Interaction, interacted, interacting } from "./listen";
import { Game, main } from "./main";
import { COLORS, FONTS, SIZES, getDaysSinceEpoch, triangle } from "./utils";

export function calendar(
	_time: DOMHighResTimeStamp,
	game: Game,
	calendarX: number,
	calendarY: number,
) {
	const cellSize = SIZES.medium(game);
	const cellPadding = 1;

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
	console.log(
		year,
		monthIndex,
		firstWeekday,
		daysInMonth,
		weeks,
		today,
		firstDays,
	);

	game.ctx.fillStyle = COLORS.fg(game);
	game.ctx.fillText(
		game.lang.calendar.date(year, monthIndex),
		calendarX + cellSize * 3.5,
		calendarY + cellSize / 2,
	);

	calendarY += cellSize;

	let i = 0;
	let j = firstWeekday;
	for (let day = 1; day <= daysInMonth; day++) {
		game.ctx.beginPath();
		game.ctx.roundRect(
			calendarX + cellPadding + cellSize * j,
			calendarY + cellPadding + cellSize * i,
			cellSize - 2 * cellPadding,
			cellSize - 2 * cellPadding,
			SIZES.teeny(game),
		);
		if (firstDays + day - 1 > today) {
			// Future days cannot be played, should be grayed out
			game.ctx.fillStyle = COLORS.gray(game);
		} else {
			// Playable days are yellow
			game.ctx.fillStyle = COLORS.yellow(game);
		}
		game.ctx.fill();
		if (interacting(game, Interaction.Down)) {
			interacted(game);
			console.log(`Clicked on day ${firstDays + day - 1}`);

			window.requestAnimationFrame((time) => main(time, game));
		}

		game.ctx.fillStyle = COLORS.fg(game);
		game.ctx.fillText(
			day.toString(),
			calendarX + cellPadding + cellSize / 2 + cellSize * j,
			calendarY + cellPadding + cellSize / 2 + cellSize * i,
		);

		// Increment i and j
		j = (j + 1) % 7;
		i = j === 0 ? i + 1 : i;
	}
}

function getDaysInMonth(year: number, monthIndex: number): number {
	return new Date(year, monthIndex + 1, 0).getDate();
}
