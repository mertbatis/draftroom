# Draft Room

Fearless draft prep for Cloud9's League of Legends coaching staff, built on the official GRID match data. Category 2 (LoL) entry for the Cloud9 x JetBrains "Sky's The Limit" Hackathon 2026.

**App (no data bundled):** https://mertbatis.github.io/draftroom/ · load your local draft index, or use the Fearless board on its own.

## What it answers
- **"What pick/ban tendencies repeat most often for this opponent?"** The *Scouting report* lists tendencies as plain sentences. Each one carries its evidence, for example "Bans Jarvan IV in the first phase in 67% of games on blue side · 12/18 games". Behind it are:
  - phase-1 bans by side;
  - most-picked champions with win rates;
  - first picks;
  - bans they face;
  - player champion pools;
  - early objectives against the league average.
- **"How does their draft shift in a Fearless Game 3, 4 or 5?"** For game 1, 2 and 3+, it shows:
  - picks by game number;
  - the share of picks that come from outside the team's 15 most-played champions;
  - the win rate in those games.
- **"What do we do right now?"** The *Fearless series board* runs a Bo3/Bo5 draft step by step in the pro order. It:
  - locks every champion picked in earlier games of the series, for both teams;
  - predicts the opponent's next ban or pick from their history, renormalised over the champions still available;
  - suggests bans on our turn;
  - shows how many of each team's comfort picks are left as the pool shrinks.

  The series is saved in the browser and exports to a text summary.
- *Self-scout* runs the same report on Cloud9 Kia: what opponents can read about us.

## Data: local only
The GRID data is licensed only for hackathon projects and must not be redistributed, even as derived data. So:
- **Draft Room ships no match data.** The hosted app is code only.
- `tools/build-index.mjs` reads your local clone of the official data repository. It streams each LoL series feed (built-in zstd), takes the final `seriesState`, and writes `.local/index.json`, which is git-ignored:
  - each game's ordered `draftActions`;
  - team objective flags;
  - rosters.

  On the full data set that is 745 series and 1,737 games, built in about 70 seconds.
- `node serve.mjs` serves the app with your local index at `http://127.0.0.1:4891`. Alternatively, open the hosted app and load `.local/index.json` with the button; it stays in your browser.

Verified on the data:
- 1,719 of 1,721 complete drafts follow the standard 20-step order. The team that drafts first is treated as blue, because the side label is swapped in 242 feeds.
- No champion repeats within any of the 568 multi-game series. Every series is Fearless.

```
git clone https://github.com/cloud9esports/stl-hackathon-2026-grid-starter.git ../stl-hackathon-2026-grid-starter
node tools/build-index.mjs --data ../stl-hackathon-2026-grid-starter
node serve.mjs            # http://127.0.0.1:4891
npm test                  # analytics unit tests (synthetic data, no GRID data needed)
```

## Code
- `src/analyze.js`: draft order, team reports, Fearless shift, league baselines, tendency sentences with evidence (shown only with at least 5 games), predictions, ban suggestions and Fearless locks. Pure and unit-tested.
- `src/app.js`: UI (plain ES modules, no build).
- `src/champs.js`: champion icons from Riot's Data Dragon at runtime.
- `tools/build-index.mjs`: the local index builder.

## JetBrains tools
Built in **WebStorm**; see [JETBRAINS.md](JETBRAINS.md).

## Legal
Draft Room is not endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc. Match data © GRID, used under the hackathon data license and never included in this repository.

## License
MIT (code only).
