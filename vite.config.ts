import { defineConfig } from "vite";
import { internalIpV4 } from "internal-ip";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// @ts-expect-error process is a nodejs global
const mobile = !!/android|ios/.exec(process.env.TAURI_ENV_PLATFORM);

// https://vitejs.dev/config/
export default defineConfig(async () => ({
	base: "spelling-bee-clone",
	plugins: [wasm(), topLevelAwait()],
}));
