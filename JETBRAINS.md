# JetBrains tools used

**WebStorm 2026.3** is the IDE for Draft Room. The `.idea/` folder (project model and inspection profile) is committed; the `.local/` data folder is excluded from the project.

- **Inspections.** The project inspection profile ran over every file with WebStorm's inspector (`inspect.bat`). Fixes that came out of it:
  - *JSCheckFunctionSignatures*: the filter parameter of `gamesOf` / `teamReport` was inferred as `null`-only. It now has JSDoc types (`events`, `lastN`, `since`).
  - *JSIgnoredPromiseFromCall*: the app's `boot()` promise was ignored. Start-up errors are now caught and shown in the status pill.
  - *JSUnusedAssignment*: a redundant initialiser in the series advice panel was removed.
  - CSS-in-template warnings for the HTML strings rendered by `app.js` were reviewed as false positives.
- **Formatter and test runner.** The analytics tests (`npm test`) run from the IDE's Node.js runner.
