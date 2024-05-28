import { Interaction, interacted, interacting } from "./listen";
import { logo } from "./logo";
import { type Game, main } from "./main";
import { COLORS, FONTS, SIZES, shrinkFontSizeToFit, wrapText } from "./utils";

export function error(_time: DOMHighResTimeStamp, game: Game) {
	console.log("Error");

	game.ctx.font = `bold ${SIZES.big(game)}px ${FONTS.default}`;
	game.ctx.textAlign = "left";
	game.ctx.textBaseline = "middle";
	game.ctx.fillStyle = COLORS.fg(game);

	game.ctx.fillText(
		game.lang.error.title,
		SIZES.small(game),
		SIZES.small(game),
	);
	game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
	game.ctx.fillText(
		game.errorText || game.lang.error.unknown,
		SIZES.small(game),
		2 * SIZES.small(game) + SIZES.big(game),
	);
}

export function loading(time: DOMHighResTimeStamp, game: Game) {
	// Only display the loading screen if the puzzle has no letters
	if (game.puzzle.letters.length !== 0) {
		// Unset splashscreen if previous loading
		if (
			game.splashScreenText != null &&
			game.splashScreenText[0] === game.lang.loading.title
		) {
			game.splashScreenText = null;
			window.requestAnimationFrame((time) => main(time, game));
		}
		return;
	}

	console.log("Loading...");
	window.requestAnimationFrame((time) => main(time, game));

	game.ctx.font = `bold ${SIZES.big(game)}px ${FONTS.default}`;
	game.ctx.textAlign = "left";
	game.ctx.textBaseline = "middle";

	const dots = ".".repeat((time / 250) % 4);
	game.splashScreenText = [
		game.lang.loading.title,
		`${game.lang.loading.description}${dots}`,
	];
}

export function splashScreen(_time: DOMHighResTimeStamp, game: Game): boolean {
	if (game.splashScreenText == null) {
		// Return false to indicate no splash screen
		return false;
	}

	// There is splash screen text, so display the splash screen
	// Logo
	const logoSize = SIZES.smallestDimension(game) - 2 * SIZES.small(game);
	const splashScreenX = game.width / 2 - logoSize / 2;
	const splashScreenY = game.height / 2 + SIZES.small(game);
	game.ctx.save();
	game.ctx.translate(splashScreenX, splashScreenY - logoSize);
	logo(game.ctx, { width: logoSize, height: logoSize }, game);
	game.ctx.restore();
	// Header
	game.ctx.font = shrinkFontSizeToFit(
		game.ctx,
		game.splashScreenText[0],
		logoSize,
		`bold ${SIZES.big(game)}px ${FONTS.default}`,
	);
	game.ctx.textAlign = "center";
	game.ctx.textBaseline = "middle";
	game.ctx.fillStyle = COLORS.fg(game);
	game.ctx.fillText(
		game.splashScreenText[0],
		game.width / 2,
		splashScreenY + SIZES.medium(game),
	);
	// Text
	game.ctx.font = `${SIZES.small(game)}px ${FONTS.default}`;
	game.ctx.textAlign = "left";
	game.ctx.textBaseline = "middle";

	wrapText(
		game.ctx,
		game.splashScreenText[1],
		splashScreenX,
		splashScreenY + 3 * SIZES.medium(game),
		logoSize,
	);

	// Any tap dismisses the splashScreen
	if (interacting(game, Interaction.AnyDown)) {
		interacted(game);
		game.splashScreenText = null;
		requestAnimationFrame((time) => main(time, game));
		return false;
	}

	// Return true to indicate there is a splash screen, and to not display
	// anything else
	return true;
}
