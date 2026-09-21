import { join } from "node:path";
import { staticPlugin } from "@elysiajs/static";
import { buildContainer } from "./container";
import { createApp } from "./http/app";

const container = buildContainer();
const { config } = container;
const app = createApp(container);

const indexHtml = join(config.webDist, "index.html");
if (await Bun.file(indexHtml).exists()) {
  app.use(staticPlugin({ assets: config.webDist, prefix: "/", indexHTML: true }));
} else {
  console.warn(`[gameshelf] pas de build front dans ${config.webDist} — API seule.`);
  console.warn("Lance `bun run build:web` (ou `bun run dev:web` pour le HMR).");
}

app.listen(config.port);
console.log(`[gameshelf] en écoute sur http://localhost:${config.port}`);
if (!config.devNoAuth) {
  console.log("[gameshelf] auth : forward-auth Authentik (en-tête X-authentik-username)");
}
