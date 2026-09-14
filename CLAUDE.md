# Working on this repository

A personal maths app for one child. Read `README.md` first — it explains why the design
is shaped the way it is.

## Non-negotiables

These are not preferences. Breaking one defeats the point of the project.

1. **No real names, faces or voices in git.** The repository is public. Names live in
   IndexedDB on the device; authored strings use `{kid}` / `{papa}` and are rendered
   through `fill()` from `src/config/profile.ts`. `public/voice/` and `public/faces/`
   are gitignored and must stay that way. Never put a real name in a commit message,
   a comment, a test fixture or a branch name.

2. **No scores in the interface.** No percentage, no accuracy, no streak, no
   correct-out-of-total, no leaderboard — on any screen. The counter on the Lab
   deliberately counts problems *attempted*, not problems solved. `scripts/smoke.mjs`
   asserts this about the summary screen; keep that assertion working.

3. **Difficulty stays unbounded.** Generators take a rating on the Elo scale and must
   keep getting harder. A generator that runs out of road raises `maxRating` honestly so
   the selector can skip it — it never clamps and repeats. Do not add a level cap.

4. **Hints are free.** Never gate them, count them against the player, or show them as
   a cost.

5. **Every generator is seeded, verifiable and unbounded.** The answer is computed, not
   authored. If a puzzle type cannot be machine-checked for a unique solution, it does
   not go in.

6. **No backend, no telemetry, no accounts.** If co-op play is added later it may carry
   game state through a relay, but never the player's name or progress.

## Conventions

- Run `npm test` and `npm run build` before pushing. Both must be clean.
- `npm run smoke` needs a preview server running; set `CHROMIUM_PATH` if Playwright
  cannot find a browser.
- Engine and content changes need tests. The selector and the generators are where a
  silent bug does the most damage — a broken scheduler ruins the product without
  throwing anything.
- iPad first. Touch targets at least 60px, never use the system keyboard for numbers
  (`src/ui/Keypad.tsx` exists for this), and keep the layout working at phone width.
- Tone: {papa} is hopeless and cheerful about it. The app is never disappointed in the
  player, and never congratulates him on being clever — only on what he actually did.
