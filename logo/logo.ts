import { XMLSerializer } from 'xmldom';
import * as C2S from "canvas2svg";
import { JSDOM } from "jsdom";
import * as canvas from "canvas";
import { logo } from "./../src/main.ts";
import { writeFileSync } from "node:fs";

const width = 100;
const height = 100;
const document = new JSDOM().window.document;
global.XMLSerializer = XMLSerializer;
const ctx = new C2S.default({ width, height, document });

logo(ctx, { width, height }, { darkMode: false });
const logoSvg = ctx.getSerializedSvg();
writeFileSync("logo/logo.svg", logoSvg);

ctx.clearRect(0, 0, width, height);
logo(ctx, { width, height }, { darkMode: true });
const logoDarkSvg = ctx.getSerializedSvg();
writeFileSync("logo/logo-dark.svg", logoDarkSvg);
