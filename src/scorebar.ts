import { Interaction, interacting } from "./listen";
import { type Game, main } from "./main";
import { COLORS, FONTS, SIZES } from "./utils";

const SCORERANKS: number[] = [
	0, 0.02, 0.05, 0.08, 0.15, 0.25, 0.4, 0.5, 0.7, 1,
];

export function scorebar(_time: DOMHighResTimeStamp, game: Game) {
	let rank =
		SCORERANKS.findIndex(
			(minScore) =>
				game.puzzle.score < Math.round(minScore * game.puzzle.maxScore),
		) - 1;
	// Rank is Queen Bee if no min score is < the score
	if (rank === -2) {
		rank = SCORERANKS.length - 1;
	}

	if (rank === SCORERANKS.length - 2 && !game.geniusReached) {
		// If Genius just reached, display the Genius splash screen
		game.splashScreenText = game.lang.score.geniusSplashScreen;
		game.geniusReached = true;
		window.requestAnimationFrame((time) => main(time, game));
	}

	if (rank === SCORERANKS.length - 1 && !game.queenBeeReached) {
		// If Queen Bee just reached, display the Queen Bee splash screen
		game.splashScreenText = game.lang.score.queenBeeSplashScreen;
		game.queenBeeReached = true;
		window.requestAnimationFrame((time) => main(time, game));
	}

	const scorebarWidth = game.width - 2 * SIZES.tiny(game);
	const scorebarX = game.width / 2 - scorebarWidth / 2;
	const scorebarY = 3 * SIZES.small(game);
	game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.default}`;
	const rankWidth =
		SIZES.tiny(game) +
		Math.max(
			...game.lang.score.ranks.map((rank) => game.ctx.measureText(rank).width),
		);
	const tickWidth =
		(scorebarWidth - rankWidth - 2 * SIZES.teeny(game)) /
		(SCORERANKS.length - 1);

	// Score bar
	let displayRank = game.lang.score.ranks[rank];
	// Stroke achieved portion in yellow
	game.ctx.beginPath();
	game.ctx.moveTo(scorebarX + rankWidth, scorebarY);
	game.ctx.lineTo(scorebarX + rankWidth + tickWidth * rank, scorebarY);
	game.ctx.strokeStyle = COLORS.yellow(game);
	game.ctx.stroke();
	// Stroke the rest in gray
	game.ctx.beginPath();
	game.ctx.moveTo(scorebarX + rankWidth + tickWidth * rank, scorebarY);
	game.ctx.lineTo(scorebarX + scorebarWidth, scorebarY);
	game.ctx.strokeStyle = COLORS.gray(game);
	game.ctx.stroke();

	// Score ticks
	game.ctx.textBaseline = "middle";
	// Only allow interacting with one tick at a time by defaulting to undefined
	// and only allow interaction when undefined. At the end of the loop of the
	// interacted with tick, set to false to disable further interaction.
	let interactingWithTick = undefined;
	for (let i = 0; i < SCORERANKS.length; i++) {
		const tickX = scorebarX + rankWidth + SIZES.teeny(game) + i * tickWidth;

		let tickRadius = SIZES.teeny(game);
		if (i === rank) {
			tickRadius = SIZES.tiny(game);
		}
		// Temporary extra large tick mark to check for interaction
		game.ctx.beginPath();
		game.ctx.arc(tickX, scorebarY, SIZES.tiny(game), 0, 2 * Math.PI);
		if (
			interactingWithTick === undefined &&
			interacting(game, Interaction.Hover)
		) {
			interactingWithTick = true;
			// Increase radius of tick when interacting
			tickRadius = SIZES.tiny(game);
		}

		if (i <= rank) {
			game.ctx.fillStyle = COLORS.yellow(game);
		} else {
			game.ctx.fillStyle = COLORS.gray(game);
		}

		game.ctx.beginPath();
		game.ctx.arc(tickX, scorebarY, tickRadius, 0, 2 * Math.PI);
		game.ctx.fill();

		game.ctx.textAlign = "center";
		game.ctx.fillStyle = COLORS.fg(game);
		if (interactingWithTick) {
			// Display min score for rank if interacting
			game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.word}`;
			game.ctx.fillText(
				Math.round(game.puzzle.maxScore * SCORERANKS[i]).toString(),
				tickX,
				scorebarY,
			);
			// Change rank to this tick's rank while interacting
			displayRank = game.lang.score.ranks[i];
		} else if (i === rank) {
			// Display current score if this is the current rank
			game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.word}`;
			game.ctx.fillText(game.puzzle.score.toString(), tickX, scorebarY);
		}

		if (interactingWithTick) {
			interactingWithTick = false;
		}
	}

	// Rank
	game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.default}`;
	game.ctx.textAlign = "left";
	game.ctx.textBaseline = "middle";
	game.ctx.fillStyle = COLORS.fg(game);
	game.ctx.fillText(displayRank, scorebarX, scorebarY);
}
