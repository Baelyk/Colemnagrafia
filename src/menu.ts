import { hints } from "./hints";
import { type Game, main } from "./main";
import { getPuzzle, restartPuzzle } from "./puzzle";
import { COLORS, FONTS, SIZES, getTextHeight } from "./utils";

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
}

function menu(_time: DOMHighResTimeStamp, game: Game, menuY: number, menuWidth: number, menuX: number, menuHamburgerHeight: number, menuHeight: number) {
  if (!game.menuOpen) {
    game.ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      game.ctx.roundRect(menuX, menuY + menuHamburgerHeight * 1.5 + 4 * i * menuHamburgerHeight, menuWidth, menuHamburgerHeight, SIZES.tiny(game));
    }
    game.ctx.fillStyle = COLORS.fg(game);
    game.ctx.fill();

    // Detect interaction
    game.ctx.beginPath();
    game.ctx.rect(menuX, menuY, menuWidth, menuHeight);
    if (game.mouseDown && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
      game.mouseDown = false;
      game.menuOpen = true;

      window.requestAnimationFrame((time) => main(time, game));
    }

  }

  if (game.menuOpen) {
    const menuButtonWidth = game.width - 2 * SIZES.small(game);
    const menuX = (game.width - menuButtonWidth) / 2;

    game.ctx.font = `${SIZES.small(game)}px ${FONTS.default}`
    game.ctx.textAlign = "left";
    game.ctx.textBaseline = "middle";
    const menuButtonHeight = getTextHeight(game.ctx, "A") + SIZES.small(game);
    const menuRowHeight = menuButtonHeight + SIZES.small(game);

    const menuOptions: [string, () => void][] = [
      ["Restart", () => {
        restartPuzzle(game);
        game.menuOpen = false;

        window.requestAnimationFrame((time) => main(time, game));
      }],
      ["Check for new puzzle", () => {
        getPuzzle(game, "daily");
        game.menuOpen = false;

        window.requestAnimationFrame((time) => main(time, game));
      }],
      [game.revealAnswers ? "Stop revealing answers" : "Reveal answers", () => {
        game.revealAnswers = !game.revealAnswers;
        if (game.revealAnswers) {
          game.wordlistIsOpen = true;
        }
        game.menuOpen = false;

        window.requestAnimationFrame((time) => main(time, game));
      }],
      [`${game.darkMode ? "Light" : "Dark"} mode`, () => {
        game.darkMode = !game.darkMode;
        game.menuOpen = false;

        document.documentElement.style.setProperty("background-color", COLORS.bg(game));

        window.requestAnimationFrame((time) => main(time, game));
      }]
    ];

    const menuY = game.height / 2 - menuOptions.length * menuRowHeight / 2;

    menuOptions.forEach(([menuOptionText, menuOptionAction], i) => {
      game.ctx.beginPath();
      game.ctx.roundRect(menuX, menuY + menuRowHeight * i, menuButtonWidth, menuButtonHeight, SIZES.teeny(game));
      if (game.mouseDown && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
        game.mouseDown = false;

        menuOptionAction();

        game.ctx.fillStyle = COLORS.darkgray(game);
        window.requestAnimationFrame((time) => main(time, game));
      } else {
        game.ctx.fillStyle = COLORS.bg(game);
      }
      game.ctx.fill();
      game.ctx.strokeStyle = COLORS.fg(game);
      game.ctx.stroke();

      game.ctx.fillStyle = COLORS.fg(game);
      game.ctx.fillText(menuOptionText, menuX + SIZES.small(game), menuY + menuButtonHeight / 2 + (menuRowHeight) * i);
    });

    // Any interaction not on a menu option closes the menu
    if (game.mouseDown) {
      game.mouseDown = false;
      game.menuOpen = false;

      window.requestAnimationFrame((time) => main(time, game));
    }
  }
}

