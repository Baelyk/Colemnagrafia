import { type Game, main } from "./main";
import { submitWord } from "./puzzle";
import { COLORS, FONTS, SIZES } from "./utils";

export function controls(_time: DOMHighResTimeStamp, game: Game) {
  const controlY = game.height - SIZES.big(game);
  const controlRadius = SIZES.small(game);
  const controlWidth = controlRadius * 4;
  const controlsWidth = controlWidth * 2 + controlRadius + SIZES.medium(game) * 2;
  game.ctx.font = `${SIZES.tiny(game)}px ${FONTS.default}`;
  game.ctx.textAlign = "center";
  game.ctx.textBaseline = "middle";
  game.ctx.strokeStyle = COLORS.fg(game);

  // Delete
  const deleteX = game.width / 2 - controlsWidth / 2;
  game.ctx.beginPath();
  game.ctx.roundRect(deleteX, controlY - controlRadius, controlWidth, controlRadius * 2, controlRadius);
  game.ctx.fillStyle = COLORS.bg(game);
  if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.ctx.fillStyle = COLORS.darkgray(game);
      game.puzzle.word = game.puzzle.word.substring(0, game.puzzle.word.length - 1);
      window.requestAnimationFrame((time) => main(time, game));
    }
  }
  game.ctx.lineWidth = 1;
  game.ctx.stroke();
  game.ctx.fill();
  game.ctx.fillStyle = COLORS.fg(game);
  game.ctx.fillText("Delete", deleteX + controlWidth / 2, controlY);

  // Shuffle
  game.ctx.beginPath();
  game.ctx.arc(game.width / 2, controlY, controlRadius, 0, 2 * Math.PI)
  game.ctx.fillStyle = COLORS.bg(game);
  if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.ctx.fillStyle = COLORS.darkgray(game);
      game.puzzle.letters = game.puzzle.letters
        .map((letter, i) => ({ letter, sort: i === 0 ? 0 : Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ letter }) => letter);
      window.requestAnimationFrame((time) => main(time, game));
    }
  }
  game.ctx.lineWidth = 1;
  game.ctx.stroke();
  game.ctx.fill();
  // Shuffle symbol
  game.ctx.save();
  game.ctx.translate(game.width / 2, controlY);
  game.ctx.rotate(-Math.PI / 4);

  // Arrow lines
  const arrowLineArcAngle = 7 * Math.PI / 8;
  game.ctx.beginPath();
  game.ctx.arc(0, 0, SIZES.tiny(game), 2 * Math.PI / 4, 2 * Math.PI / 4 + arrowLineArcAngle);
  game.ctx.stroke();
  game.ctx.beginPath();
  game.ctx.arc(0, 0, SIZES.tiny(game), 6 * Math.PI / 4, 6 * Math.PI / 4 + arrowLineArcAngle);
  game.ctx.stroke();

  // Upper arrow head
  game.ctx.save();
  game.ctx.translate(0, -SIZES.tiny(game));
  // π/4.5 based on aesthetic (around π/6 should be correct)
  game.ctx.rotate(-Math.PI / 4.5);
  game.ctx.beginPath();
  game.ctx.moveTo(0, 0);
  game.ctx.lineTo(SIZES.teeny(game), 0);
  game.ctx.moveTo(0, 0);
  game.ctx.lineTo(0, SIZES.teeny(game));
  game.ctx.stroke();
  game.ctx.restore();

  // Lower arrow head
  game.ctx.save();
  game.ctx.translate(0, SIZES.tiny(game));
  game.ctx.rotate(Math.PI - Math.PI / 4.5);
  game.ctx.beginPath();
  game.ctx.moveTo(0, 0);
  game.ctx.lineTo(SIZES.teeny(game), 0);
  game.ctx.moveTo(0, 0);
  game.ctx.lineTo(0, SIZES.teeny(game));
  game.ctx.stroke();
  game.ctx.restore();

  game.ctx.restore();

  // Enter
  const enterX = game.width / 2 + controlsWidth / 2 - controlWidth;
  game.ctx.beginPath();
  game.ctx.roundRect(enterX, controlY - controlRadius, controlWidth, controlRadius * 2, controlRadius);
  game.ctx.fillStyle = COLORS.bg(game);
  if (!game.wordlistIsOpen && game.ctx.isPointInPath(game.mouseX, game.mouseY)) {
    if (game.mouseDown) {
      game.mouseDown = false;
      game.ctx.fillStyle = COLORS.darkgray(game);

      submitWord(game);

      window.requestAnimationFrame((time) => main(time, game));
    }
  }
  game.ctx.lineWidth = 1;
  game.ctx.stroke();
  game.ctx.fill();
  game.ctx.fillStyle = COLORS.fg(game);
  game.ctx.fillText("Enter", enterX + controlWidth / 2, controlY);
}
