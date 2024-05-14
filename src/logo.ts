import { hexagon, HasSize, HasDarkMode, SIZES, COLORS } from "./utils";

/**
 * Draw the logo to the specified canvas, filling it.
 */
export function logo(
	ctx: CanvasRenderingContext2D,
	size: HasSize,
	{ darkMode }: HasDarkMode,
) {
	const hexRadius = SIZES.smallestDimension(size) / 4;

	// Background
	ctx.beginPath();
	roundRect(
		ctx,
		0,
		0,
		size.width,
		size.height,
		SIZES.smallestDimension(size) / 4,
	);
	ctx.fillStyle = COLORS.bg({ darkMode });
	ctx.fill();

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

// Since canvas2svg doesn't implement it
function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
) {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.arc(x + width - radius, y + radius, radius, (3 * Math.PI) / 2, 0);
	ctx.lineTo(x + width, y + height - radius);
	ctx.arc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2);
	ctx.lineTo(x + radius, y + height);
	ctx.arc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI);
	ctx.lineTo(x, y + radius);
	ctx.arc(x + radius, y + radius, radius, Math.PI, (3 * Math.PI) / 2);
}
