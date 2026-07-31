import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import youtubeEmbeds from "./src/markdown/youtube-embeds.mjs";

export default defineConfig({
  site: "https://noetheca.github.io",
  base: "/aesthetics",
  output: "static",
  build: {
    format: "directory",
  },
  markdown: {
    syntaxHighlight: false,
    processor: unified({ remarkPlugins: [youtubeEmbeds] }),
  },
});
