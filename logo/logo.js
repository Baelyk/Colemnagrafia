import { JSDOM } from "jsdom";
import * as canvas from "canvas";
import * as C2S from "canvas2svg";

import { logo } from "./../src/main.ts";

console.log(C2S);
console.log(JSON.stringify(C2S));

const document = new JSDOM().window.document;
const ctx = new C2S.default({ document });
