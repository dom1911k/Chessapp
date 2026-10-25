# ♟️ Chess Coach

A patient, beginner-friendly chess coach for Android. It plays against you,
explains your mistakes in plain language, trains you with puzzles and brings
your own mistakes back until they stick.

**Everything runs on your phone.** No account, no internet, no ads, no AI service —
the explanations come from the Stockfish chess engine plus a set of coaching rules
built into the app.

| | |
|---|---|
| **Play** | Nine opponents with their own portraits and personalities, from Lily (~400) to Mei (~2000) — they chat, react and play in their own style — or a custom-strength bot from ~400 to ~2000 Elo, unlimited take-backs, hints, "Threats?" (what is my opponent planning?), "Why not this move?", safety overlay, notes when the bot attacks something. Every move is rated Best / Good / Inaccuracy / Mistake / Blunder; on a mistake the coach pauses and explains. Optional move confirmation against slips. |
| **Puzzles** | ~20,000 Lichess puzzles (rated 600–1800), your own puzzle rating, 15 themed sets, and Puzzle Rush (3 minutes, 3 mistakes). |
| **Daily** | A 10–15 minute session: reviews of positions you got wrong (from your games and puzzles) on a 1 → 3 → 7 → 14 → 30 day schedule, plus new puzzles on your weakest themes. Optional daily reminder. |
| **Learn** | Six guided lessons (checkmate, free pieces, forks, pins, back rank, opening principles), endgame drills against the engine (basic mates, king-and-pawn, Lucena, Philidor, queen vs pawn) and opening names with their main ideas. |
| **Progress** | Weekly summary, rating chart, streak, blunders per game, strongest/weakest themes, and recurring mistake patterns across games. |
| **Backup** | Export everything to one file and import it on a new phone (Settings → Backup). |
| **Updates** | The app finds new versions on GitHub and installs them for you. |

---

## 📲 Installing the app (the short version)

1. On your Android phone, open **https://github.com/dom1911k/Chessapp/releases**
2. Under the newest release, tap the file ending in **.apk** (for example `ChessCoach-v1.0.0.apk`).
3. Open the downloaded file. Android will ask whether your browser may install apps —
   tap **Settings**, switch on **Allow from this source**, go back, and tap **Install**.
4. Open **Chess Coach**. Done!

Before the first release exists, you need to do the one-time setup below (about 15 minutes).

---

## 🛠️ One-time setup

The app is built automatically by GitHub ("GitHub Actions"). Android only installs apps
that are *signed* with a digital key, and **every future version must be signed with the
same key** — otherwise Android refuses to update the app and you would have to uninstall it
(losing your data, unless you made a backup). So first we create that key and store it
safely in GitHub as a *secret*.

### Step 1 — Choose a password

Think of a strong password (at least 12 characters, e.g. four random words).
**Write it into your password manager now.** You will need it if you ever move the project.

### Step 2 — Add the password to GitHub

1. Open your repository on github.com: **https://github.com/dom1911k/Chessapp**
2. Click **Settings** (top bar of the repository) → in the left menu **Secrets and variables** → **Actions**.
3. Click **New repository secret**.
   - **Name:** `ANDROID_KEYSTORE_PASSWORD`
   - **Secret:** your password
   - Click **Add secret**.

### Step 3 — Create the signing key on your computer

You need Java installed (free: <https://adoptium.net> → download the "JDK", install with the defaults).
Then open a terminal (Windows: press Start, type `cmd`, Enter; Mac: open the "Terminal" app) and run:

```
keytool -genkeypair -keystore chess-coach-release.keystore -storetype PKCS12 -alias chesscoach -keyalg RSA -keysize 4096 -validity 36500 -dname "CN=Chess Coach"
```

It asks for a password twice — use the same password as in Step 1.
Then turn the file into text:

- **Windows:** `certutil -encodehex -f chess-coach-release.keystore keystore-base64.txt 0x40000001`
- **Mac:** `base64 -i chess-coach-release.keystore -o keystore-base64.txt`
- **Linux:** `base64 -w 0 chess-coach-release.keystore > keystore-base64.txt`

Open `keystore-base64.txt` (any text editor, e.g. Notepad), select all, copy. Then in
**Settings → Secrets and variables → Actions → New repository secret**:

- **Name:** `ANDROID_KEYSTORE_BASE64`
- **Secret:** paste the text → **Add secret**.

**Keep `chess-coach-release.keystore` and your password somewhere safe** (e.g. a password manager and
Google Drive). Never upload the keystore to the repository — it's public.

### Your secrets at a glance

| Secret name | Required | Value |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64` | yes | the text from `keystore-base64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | yes | your keystore password |
| `ANDROID_KEY_ALIAS` | no | only if you made your own key with a different alias (default: `chesscoach`) |
| `ANDROID_KEY_PASSWORD` | no | only if your key password differs from the keystore password |

---

## 🚀 Making a release (a new version of the app)

**The easy way (from the browser):**

1. Repository → **Actions** → **Android release** (left list) → **Run workflow**.
2. Type a version number, e.g. `1.0.0` for the first one. Every new release needs a **higher** number
   (`1.0.1`, `1.1.0`, `2.0.0`, …).
3. Click **Run workflow** and wait ~5–10 minutes for the green check mark.
4. The new version appears under **Releases** (right side of the repository's main page) with the APK attached.

**The developer way:** push a tag, e.g.

```
git tag v1.0.1
git push origin v1.0.1
```

The version number and Android's internal version code are taken from the tag
(`v1.2.3` → version 1.2.3, code 10203), so newer releases always install over older ones.

---

## 🔄 Updating the app on your phone

**Inside the app:** once a day (when you're online) Chess Coach checks GitHub for a new release and asks
whether to update. You can also check any time under **⚙️ Settings → App updates → Check for updates**.
Tap **Update**: the app downloads the new APK and Android shows its install screen — tap **Update** there.
The first time, Android asks you to allow Chess Coach to install apps ("Allow from this source").
Your games, puzzle rating, streak and review cards are kept.

**Manually:** open the Releases page on your phone, download the newest `.apk`, open it and tap **Update**.

Extra safety: before big updates or when changing phones, use **⚙️ Settings → Backup → Export**.

> ⚠️ Never uninstall the app to "update" it — uninstalling deletes its data. If Android ever says
> *"App not installed as package conflicts with an existing package"*, the APK was signed with a
> different key: make sure the secrets still contain your original key.

---

## 💡 Using Chess Coach

- **Moving pieces:** tap a piece, then tap a highlighted square — or drag it.
- **Hint 💡:** press up to three times — first the idea, then the piece, then the move.
- **Take back ↶:** as often as you like; the coach tells you whether it was a good idea.
- **Why not…? 🔍:** opens an analysis board at your last move: try any other move and the coach explains it.
- **Safety 🛡️:** marks your pieces that can be taken for free (red) and checkmate threats.
- **Android back button:** closes dialogs and goes back a screen; on the Play screen press it twice to leave.
  An unfinished game is saved and continues when you come back.

---

## 👩‍💻 For developers

Tech: Vite + React + TypeScript + Tailwind, Capacitor 8 (Android), chess.js, react-chessboard,
Stockfish 19 lite single-threaded WASM in a Web Worker, Dexie (IndexedDB), Capacitor Preferences.

```
npm install          # also copies the Stockfish WASM into public/engine
npm run dev          # http://localhost:5173 — the whole app works in a desktop browser
npm test             # unit tests (coach rules, tactics, SRS, endgame positions, backup)
npm run build && npx cap sync android && (cd android && ./gradlew assembleDebug)
```

### Project layout

```
src/lib/engine/        UCI client (Web Worker in the app, Node in tests)
src/lib/chess/         board geometry, static exchange evaluation, eval → win% → classification
src/lib/coach/         the coaching explanation engine
  tactics.ts           motif detection: forks, pins, skewers, discovered attacks, back-rank mates…
  context.ts           everything a rule may ask about a move (lazy, cached)
  rules/problems.ts    "what goes wrong" — reads the opponent's best reply
  rules/ideas.ts       "what was better" — reads the engine's best line
  rules/principles.ts  opening principles
  rules/praise.ts      positive feedback
  templates.ts         all sentences, several variants each
  hints.ts, safety.ts, takeback.ts
src/lib/bot.ts         bot strength (MultiPV + Elo-dependent randomness)
src/lib/puzzles/       puzzle data, rating, selection, attempts
src/lib/srs.ts         spaced repetition
src/lib/endgames.ts    endgame drills
src/lib/openings/      ECO table (names + main ideas)
src/screens/, src/components/   UI
scripts/build-puzzles.mjs       puzzle preprocessing
```

**Adding a coaching rule:** write an object with `id`, `kind`, `theme` and a `detect(ctx)` function
that returns a sentence (or `null`), add sentence variants to `templates.ts`, and put the rule into
the matching list in `src/lib/coach/rules/`. Earlier rules in a list take priority.

### Rebuilding the puzzle set

The bundled puzzles in `public/puzzles/` were made with:

```
npm run puzzles                                   # downloads the Lichess DB (~300 MB) into .cache/
npm run puzzles -- --input lichess_db_puzzle.csv.zst --count 20000 --min 600 --max 1800
```

The script streams and decompresses the file, keeps popular, well-rated puzzles with short
solutions, and picks a seeded, balanced sample across 16 themes and six rating bands.

### In-app updates

`src/lib/update.ts` asks the GitHub API for the latest release of `REPO` and compares versions;
`android/.../ApkUpdaterPlugin.java` downloads the `.apk` asset and opens the system installer
(permission `REQUEST_INSTALL_PACKAGES`).

### Icons

The icon is drawn in `assets/icon-foreground.svg`; `node scripts/make-icons.cjs` renders all Android sizes.

### Data storage

Games, attempts and review cards live in IndexedDB inside the app's WebView; settings in Capacitor
Preferences. Both are in the app's private storage, which Android keeps when an APK signed with the
same key is installed over the old one. Don't change `appId` in `capacitor.config.ts`.

## Credits & licenses

- [Stockfish](https://stockfishchess.org) via [stockfish.js](https://github.com/nmrugg/stockfish.js) — GPLv3.
  Because the APK contains Stockfish, the app as a whole is distributed under the GPLv3; its full source is this repository.
- Puzzles: [Lichess puzzle database](https://database.lichess.org/#puzzles) — CC0.
- Character portraits: "Avataaars" by Pablo Stanley (free for personal and commercial use), generated with [DiceBear](https://www.dicebear.com) (MIT) — see `scripts/make-portraits.mjs`.
- [chess.js](https://github.com/jhlywa/chess.js) (BSD-2), [react-chessboard](https://github.com/Clariity/react-chessboard) (MIT), [Capacitor](https://capacitorjs.com) (MIT), [Dexie](https://dexie.org) (Apache-2.0).
