// Worker entry. Media files are served straight from R2; every other request
// goes to the Next app that `opennextjs-cloudflare build` writes to .open-next.
import nextWorker from "./.open-next/worker.js";
import { serveMedia } from "./lib/media-serve";

const worker = {
  async fetch(request, env, ctx) {
    return (await serveMedia(request, env)) ?? nextWorker.fetch(request, env, ctx);
  },
};

export default worker;
