import { calendar } from "./calendar";
import { hints } from "./hints";
import { Interaction, interacted, interacting } from "./listen";
import { type Game, main } from "./main";
import { restartPuzzle } from "./puzzle";
import { COLORS, FONTS, SIZES, getTextHeight, wrapText } from "./utils";

export function menuBar(time: DOMHighResTimeStamp, game: Game) {
	const menuBarY = SIZES.tiny(game);
	const menuBarPadding = SIZES.tiny(game);

	const menuWidth = SIZES.small(game);
	const menuX = game.width - menuWidth - menuBarPadding;
	const menuHamburgerHeight = SIZES.teeny(game) / 2;
	const menuHeight = 3 * 4 * menuHamburgerHeight;
	menu(time, game, menuBarY, menuWidth, menuX, menuHamburgerHeight, menuHeight);
	if (game.menuOpen) {
		return;
	}

	hints(time, game, menuBarY, menuBarPadding, menuHeight, menuX);
	if (game.hintsOpen) {
		return;
	}

	date(time, game, menuBarY, menuBarPadding);
}

function menu(
	time: DOMHighResTimeStamp,
	game: Game,
	menuY: number,
	menuWidth: number,
	menuX: number,
	menuHamburgerHeight: number,
	menuHeight: number,
) {
	if (!game.menuOpen) {
		game.ctx.beginPath();
		for (let i = 0; i < 3; i++) {
			game.ctx.roundRect(
				menuX,
				menuY + menuHamburgerHeight * 1.5 + 4 * i * menuHamburgerHeight,
				menuWidth,
				menuHamburgerHeight,
				SIZES.tiny(game),
			);
		}
		game.ctx.fillStyle = COLORS.fg(game);
		game.ctx.fill();

		// Detect interaction
		game.ctx.beginPath();
		game.ctx.rect(menuX, menuY, menuWidth, menuHeight);
		if (interacting(game, Interaction.Down)) {
			interacted(game);
			game.menuOpen = true;

			window.requestAnimationFrame((time) => main(time, game));
		}
	}

	if (game.menuOpen) {
		const menuButtonWidth = game.width - 2 * SIZES.small(game);
		const menuX = (game.width - menuButtonWidth) / 2;

		game.ctx.font = `${SIZES.small(game)}px ${FONTS.default}`;
		game.ctx.textAlign = "left";
		game.ctx.textBaseline = "middle";
		const menuButtonHeight = getTextHeight(game.ctx, "A") + SIZES.small(game);

		const menuOptions: [string, () => void][] = [
			[
				game.lang.menu.restart,
				() => {
					restartPuzzle(game);
					game.menuOpen = false;

					window.requestAnimationFrame((time) => main(time, game));
				},
			],
			[
				game.lang.menu.new,
				() => {
					// Delete the URL day param, if it exists, and update the page url to
					// reload and get today's puzzle
					const params = new URLSearchParams(window.location.search);
					params.delete("day");
					window.location.search = params.toString();
					game.menuOpen = false;

					window.requestAnimationFrame((time) => main(time, game));
				},
			],
			[
				game.lang.menu.old,
				() => {
					game.menuSelectingPuzzle = true;

					window.requestAnimationFrame((time) => main(time, game));
				},
			],
			[
				game.lang.menu.reveal(game.revealAnswers),
				() => {
					game.revealAnswers = !game.revealAnswers;
					if (game.revealAnswers) {
						game.wordlistIsOpen = true;
					}
					game.menuOpen = false;

					window.requestAnimationFrame((time) => main(time, game));
				},
			],
			[
				game.lang.menu.darkMode(game.darkMode),
				() => {
					game.darkMode = !game.darkMode;
					game.menuOpen = false;

					document.documentElement.style.setProperty(
						"background-color",
						COLORS.bg(game),
					);

					window.requestAnimationFrame((time) => main(time, game));
				},
			],
		];

		let menuY = 3 * SIZES.big(game);

		if (game.menuSelectingPuzzle) {
			const selected = calendar(time, game, 0, SIZES.medium(game), game.width);
			if (selected != null) {
				// Delete the URL day param, if it exists, and update the page url to
				// reload and get the selected day's puzzle
				const params = new URLSearchParams(window.location.search);
				params.set("day", selected.toString());
				window.location.search = params.toString();
				game.menuOpen = false;
				game.menuSelectingPuzzle = false;
			}
		} else {
			menuOptions.forEach(([menuOptionText, menuOptionAction]) => {
				game.ctx.fillStyle = COLORS.fg(game);
				const textHeight = wrapText(
					game.ctx,
					menuOptionText,
					menuX + SIZES.small(game),
					menuY + menuButtonHeight / 2,
					menuButtonWidth - 2 * SIZES.small(game),
				);
				const buttonHeight = textHeight + SIZES.small(game);
				game.ctx.beginPath();
				game.ctx.roundRect(
					menuX,
					menuY,
					menuButtonWidth,
					buttonHeight,
					SIZES.teeny(game),
				);
				game.ctx.strokeStyle = COLORS.fg(game);
				game.ctx.stroke();
				menuY += buttonHeight + SIZES.small(game);
				if (interacting(game, Interaction.Down)) {
					interacted(game);

					menuOptionAction();

					window.requestAnimationFrame((time) => main(time, game));
				}
			});
		}

		// Any interaction not on a menu option closes the menu
		if (interacting(game, Interaction.AnyDown)) {
			interacted(game);
			game.menuOpen = false;
			game.menuSelectingPuzzle = false;

			window.requestAnimationFrame((time) => main(time, game));
		}
	}
}

function date(
	_time: DOMHighResTimeStamp,
	game: Game,
	menuBarY: number,
	menuBarPadding: number,
) {
	game.ctx.font = `bold ${SIZES.tiny(game)}px ${FONTS.word}`;
	game.ctx.textAlign = "left";
	game.ctx.textBaseline = "middle";
	game.ctx.fillStyle = COLORS.fg(game);
	game.ctx.fillText(
		game.lang.menuBar.date(game.puzzle.day),
		menuBarPadding,
		menuBarY + menuBarPadding,
	);
}
