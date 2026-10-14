# Releasing an update

**For agents:** follow these steps in order for every update to a skill in this repo. After each step, report ✓ or ✗
with one line of evidence. If a step fails, stop and tell the user. Steps marked 🛑 need the user's explicit "yes".

Commands are for **Git Bash**, run from the repo root `D:/My_Skills`. Paths are case-sensitive on GitHub: the plugin
folder is `GapCue`, the skill folder is `gapcue`. Below, `$P` = `GapCue` and `$S` = `GapCue/skills/gapcue`.

```bash
cd "D:/My_Skills"; P="GapCue"; S="GapCue/skills/gapcue"
```

## 1. Make the change
Edit files under `$S` (or the plugin's README/docs). On the owner's PC, the installed skill is a junction to `$S`,
so the change is already live. Start a new agent session to reload `SKILL.md`.

## 2. Checks (all must pass)
```bash
node --check "$S/scripts/review.mjs"
node "$S/scripts/check-template.mjs"
T="$TEMP/gc test"; rm -rf "$T"; mkdir -p "$T"; cd "$T"
node "D:/My_Skills/$S/scripts/review.mjs" "D:/My_Skills/$S/examples/sample.json" --root "$T/reviews" --build-only
node "D:/My_Skills/$S/scripts/review.mjs" "D:/My_Skills/$S/examples/sample.json" --single-file --out "$T/single"
cd "D:/My_Skills"
```
- The two builds print `saved: …` and **no** `anchor not found` lines (the path contains a space on purpose).
- Open `"$T/single/FD-12-review.html"` from disk: the image shows, a click on a highlight opens the popup.
- `node "$S/scripts/review.mjs" --serve --root "$T/reviews" --port 8799` and in a browser, at a wide window and a narrow window:
  open a gap and a contradiction (arrows, chips, markers), approve one, add your own finding (select text → Gap),
  reload, and confirm the decision and your finding are still there. Stop the server afterwards.

## 3. Pick the new version
While on `0.x`:
- **patch** (`0.1.0 → 0.1.1`): a fix, no new behaviour.
- **minor** (`0.1.0 → 0.2.0`): a new feature, or any change to `story.json` / `state.json` (add a migration so old reviews still open).
`1.0.0` is the first stable public release. After that, **major** = old saved reviews can't be opened any more.

## 4. Bump and describe
- Edit `version` in `$P/.claude-plugin/plugin.json` **and** `metadata.version` in `$P/skills/gapcue/SKILL.md` (same number;
  `check-template.mjs` fails if they differ). Claude Code only offers an update when plugin.json changes; the skill's own
  "update available" notice and the page footer read SKILL.md.
- Add a section at the top of `$P/CHANGELOG.md`: `## X.Y.Z - YYYY-MM-DD` with short user-facing bullets (Added / Changed / Fixed).

## 5. Validate the manifests
```bash
claude plugin validate --strict .
claude plugin validate --strict "./$P"
```
Both print `✔ Validation passed`.

## 6. Public-safety check
```bash
git add -A && git status --short
git diff --cached --stat
```
- Skim every staged file. No client stories, screenshots, names, secrets, or reviews (`*-review*`, `gapcue-reviews/`).
- Build the app ZIP from the **staged files** and list it (uses git, so no extra zip tool is needed):
```bash
rm -f gapcue.zip; git archive --format=zip --prefix=gapcue/ -o gapcue.zip "$(git write-tree):$S"; unzip -l gapcue.zip
```
  The list starts with `gapcue/SKILL.md` and contains only the skill's files.

## 7. 🛑 Ask the user to confirm the release
Show: the version, the CHANGELOG section, and the staged file list. Wait for "yes".

## 8. Commit, tag, push, release
```bash
V=$(node -p "require('./$P/.claude-plugin/plugin.json').version")
git commit -m "release(gapcue): v$V"
git tag "gapcue-v$V"
git push origin main "gapcue-v$V"
rm -f gapcue.zip; git archive --format=zip --prefix=gapcue/ -o gapcue.zip "gapcue-v$V:$S"
node -e "const s=require('fs').readFileSync('$P/CHANGELOG.md','utf8');const m=s.split(/^## /m)[1];require('fs').writeFileSync('notes.md','## '+m)"
gh release create "gapcue-v$V" gapcue.zip --title "GapCue v$V" --notes-file notes.md
rm -f notes.md gapcue.zip
```

## 9. Check the published update
- Claude Code: `claude plugin marketplace update red-cloud-skills` then `claude plugin update gapcue@red-cloud-skills`
  in a setup **without** the local junction; confirm the new version loads.
- Other agents: `npx skills add Red-Cloud2000/skills --skill gapcue` in an empty temp folder; confirm `SKILL.md` and `scripts/` arrived.
- The release page shows `gapcue.zip`.

## 10. Report
A short summary: each step ✓/✗, the version, the release link, and what users should do to update
(Claude Code: `claude plugin update gapcue@red-cloud-skills`; other agents: `npx skills update`; apps: upload the new ZIP).
Remind them that reviews built earlier keep the old page design until rebuilt ("New version" or "Replace").

---

## Rollback (owner's PC only)
The installed skill is a junction: `%USERPROFILE%\.claude\skills\gapcue` → `D:\My_Skills\GapCue\skills\gapcue`.
- Remove the junction with `cmd /c rmdir "%USERPROFILE%\.claude\skills\gapcue"` (never `rm -r`, which deletes the files on D:).
- The pre-move backup is in `%USERPROFILE%\.claude\skill-backups\story-gap-review\`.
- The skill needs drive D: to be connected.
