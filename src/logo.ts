import { hexagon, HasSize, HasDarkMode, SIZES, COLORS } from "./utils";

/**
 * Draw the logo to the specified canvas, filling it.
 */
export function logo(
	ctx: CanvasRenderingContext2D,
	size: HasSize,
	{ darkMode }: HasDarkMode,
) {
	const hexRadius = SIZES.smallestDimension(size) / 3.165;

	// Center hexagon
	const centerX = size.width / 2;
	const centerY = size.height / 2;
	hexagon(ctx, centerX, centerY, hexRadius);
	ctx.fillStyle = COLORS.yellow({ darkMode });
	ctx.fill();

	// Surrounding hexagons
	const radians = (2 * Math.PI) / 6;
	const radius = 1.9 * hexRadius;
	for (let i = 1; i <= 6; i++) {
		const x = centerX + Math.cos(radians * i + radians / 2) * radius;
		const y = centerY + Math.sin(radians * i + radians / 2) * radius;
		hexagon(ctx, x, y, hexRadius);
		ctx.fillStyle = COLORS.gray({ darkMode });
		ctx.fill();
	}
}
