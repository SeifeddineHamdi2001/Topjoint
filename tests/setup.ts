import { createRequire, registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const req = createRequire(import.meta.url);
const emptyServerOnlyPath = path.resolve(path.dirname(req.resolve("server-only")), "empty.js");
const emptyServerOnlyUrl = pathToFileURL(emptyServerOnlyPath).href;

// Allow testing "server-only" Next.js domain modules inside Node/tsx outside the Next runtime.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { shortCircuit: true, url: emptyServerOnlyUrl };
    }
    return nextResolve(specifier, context);
  },
});

// Ensure cryptographic unit tests have a valid fallback key even when no .env file is loaded.
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  process.env.AUTH_SECRET = "test-only-fallback-secret-at-least-32-chars";
}
