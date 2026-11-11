# Verse Scroll

A personal ESV Bible app: a full-screen vertical feed, one verse per card. The spec lives in the
"Verse Scroll — App Spec" doc.

**Done:** milestones 1 to 5 (spike, In Order feed, picker and progress, Random, settings and backup).

## Run it on your Android phone

Install the **Expo Go** app on your phone. Then on your computer, in Command Prompt:

```
cd /d "%USERPROFILE%\Documents\verse-scroll"
npm install
npx expo start
```

Or just double-click **start.bat**. Open Expo Go, tap **Scan QR code**, and scan the code. If the phone can't connect, use `npx expo start --tunnel` (or **start-tunnel.bat**) instead.

## What to check for milestone 5

All in **Settings** unless noted.

| Check | How | Pass when |
| --- | --- | --- |
| Verses per card | Set 3, go back to Read | Cards show 3 verses with small verse numbers, and you stay at the same place |
| Card size in Random | With 3 set, open Random | Cards show a group of verses from one chapter |
| Long groups fit | Set 5, find a long passage (e.g. Romans 3) | Text shrinks to fit; nothing is cut off |
| Text size | Try Small and Extra large | Verse text changes size right away |
| Theme | Pick Dark, then Light, then System | The whole app switches, including Settings |
| Remembered | Change the Random filter and card size, close and reopen Expo Go | Both are kept |
| Export backup | Tap **Export backup** | The share sheet opens with a .json file; save it (e.g. to Drive) |
| Import backup | Reset Random history on Progress, then **Import backup** and pick the file | Seen verses come back on Progress; Read returns to the saved place |

Earlier milestone checks should still pass.

The Raw API screen is under **Settings → Developer: raw API response**.

## Install builds

`.github/workflows/build.yml` builds an unsigned iOS `.ipa` (for SideStore) and an Android APK on GitHub's machines. Put this folder in a GitHub repository, open **Actions → Build apps → Run workflow**, and download the files under **Artifacts**. It hasn't been run yet, so expect to fix a step the first time.

## Code layout

```
src/app/       Screens (Expo Router): tabs (Read, Random, Progress), picker, settings, raw response
src/cache/     Cache rules (ESV storage limits) and the SQLite chapter cache
src/data/      Verse counts and Random weights (no Scripture text)
src/db/        Database setup
src/esv/       ESV client, parser, book list, cache-first chapter loading
src/feed/      Full-screen feed, cards, verse grouping, jump requests
src/progress/  Progress summary and the chapters-read hook
src/settings/  Settings values, live settings store
src/backup/    Backup format, export and import
src/random/    Weighted sampler, Random feed, single-verse loading
scripts/       build-weights.ts: OpenBible.info data to src/data/weights.ts
src/storage/   API key (keychain), reading position, chapters read, verses seen
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`.
