---
name: verify-in-browser
description: Verify a UI or full-stack change by actually driving the running app with Playwright and reading the screenshots — not just trusting tsc/build. Use after implementing any frontend or API change in this app, before reporting it done, and whenever a UI symptom needs root-causing.
---

# Verify in browser

A passing build proves the code compiles, not that the feature works. This is the loop: drive it, look at it, and if it's wrong, find out **where** it's wrong before touching any code.

## 1. Confirm what's actually serving the app

Don't assume — this app can be running as a host `next dev`/`bun run dev` process, or as the `app` Docker container (`docker-compose.yml`), and they can silently swap which one owns port 3000. Check first:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep my-app-app
curl -s -w "\n%{http_code}\n" http://localhost:3000/api/health
```

If you're iterating on source and a Docker container is what's listening, your edits won't be live until you rebuild that container (§4). Prefer running `next dev` on the host while iterating; switch back to Docker only to verify the containerized path itself.

## 2. Drive it and screenshot

Write a throwaway script to `.claude/tmp/` (gitignored — create the dir if missing) using Playwright. Reuse the seeded admin credentials from `prisma/seed.ts` to log in rather than hardcoding a copy here.

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1000, height: 900 } })).newPage();
await page.goto('http://localhost:3000/login');
// ...log in, navigate, interact...
await page.screenshot({ path: '.claude/tmp/state.png', fullPage: true });
await browser.close();
```

Run it with `node`. If `playwright` isn't in `node_modules`, install it with the project's package manager (`bun add -d playwright`) — check `packageManager` in `package.json` first, a plain `npm install` is blocked by this repo's pre-commit hook.

**Read every screenshot with the Read tool before claiming anything works.** A script exiting 0 only proves nothing threw — it does not prove the pixels are right.

## 3. When something's off, don't guess from the UI alone

A wrong screenshot has two possible causes: the frontend rendered wrong, or the frontend rendered correctly what the backend gave it. Before changing any UI code, rule out the second:

- **Server/container logs**: `docker logs my-app-app-1 --tail 50`, `docker logs my-app-worker-1 --tail 50` (or the host dev server's terminal). Look for the actual thrown error, not just the symptom.
- **Database state**: query directly rather than inferring from the app.
  ```bash
  docker exec my-app-postgres-1 psql -U docvault -d docvault -c "SELECT ..."
  ```
- **Response body**: `curl` the API route directly with a logged-in session cookie to isolate frontend from backend.

Only once you know which side is wrong should you start editing.

## 4. Rebuild if the fix touches a Docker-served path

`docker compose build <service>` can silently reuse a stale cached image and ignore Dockerfile/`docker-compose.yml` changes (observed with a `build.target` change that it refused to pick up). If a rebuilt container doesn't reflect your change, don't debug the cache — bypass it:

```bash
docker build --target <stage> -t my-app-<service> .   # e.g. --target runner -t my-app-app
docker compose up -d --force-recreate <service>
```

Verify the right code is actually running before re-testing: `docker inspect my-app-<service>-1 --format '{{.Config.Cmd}}'` should match the Dockerfile stage you intended, and a fresh `docker logs` tail should show no stale-code errors.

## 5. Re-verify with the same script, then clean up

Re-run the exact script from step 2 — same steps, same assertions — to confirm the fix, not a new one-off check. Once confirmed:

```bash
rm -rf .claude/tmp
```

Never leave verification scripts or screenshots in the repo or its root — they're throwaway, not artifacts.
