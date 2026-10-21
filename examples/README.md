# Examples

Two click-practice packages for the fictional expense app *Kontor*, the same course you see on the website:

- `kontor-receipt-en.zip`: English
- `kontor-beleg-de.zip`: German

Import either one under **Import** in Plietschpaket. It becomes an editable app simulation with eight steps in three
chapters. The screenshots are rendered from a mock-up, so you can reuse them freely.

The format is simple: a `course.json` with chapters and steps plus the screenshots. Click targets are given relative to
the screenshot (`x`, `y`, `w`, `h` between 0 and 1). See `src/import/appsim.js` for the full description.
