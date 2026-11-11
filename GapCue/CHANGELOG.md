# Changelog

## 0.4.0 - 2026-11-11

### Added
- **What's left**: the bottom bar shows **N left**, the findings with no decision yet; click it to go to the next one.
  Step through has a **Next undecided** button, and deciding the last finding jumps back to the first undecided one.
- **Arrows for design findings**: a finding can point at a screenshot's caption, so its arrow starts at the design.
- **Arrows for general findings**: a finding not tied to one sentence gets an arrow from its button in General findings.

### Changed
- **Two copy buttons** instead of Copy comment. **Copy as Markdown** is for Markdown comment boxes such as Azure
  DevOps: highlights and colours now survive there (they were dropped when rich text was pasted).
  **Copy as rich text** is for Jira, Word, Teams and email (in Jira a highlight takes the
  nearest colour of Jira's own palette).
- **Fewer design false alarms**: a design that shows a different code, number or label than the story is no longer
  reported (the story is the source for content). A design whose behaviour differs from the story still is. The
  designs' status (on hold, not final) is reported only when the input says it in words.

### Fixed
- **Review server**: a malformed URL (such as `/%E0`) no longer stops the server, and it no longer serves files from
  sibling folders whose names start with the reviews folder's name (such as `gapcue-reviews2`).

## 0.3.0 - 2026-10-16

### Added
- **Rich text comment and questions**: the BA comment and both question editors (popup ✎ and your own findings)
  have a one-row formatting bar on top of the text: bold, italic, underline, strikethrough, text and highlight colours,
  bullets and numbers. **⌄** slides open a second row with sub-bullets (also Tab / Shift+Tab), tables (+/− row and
  column, Tab moves between cells) and Clear formatting; the choice is remembered.
  A formatted question goes into the comment as it is.
- **Copy comment keeps the formatting**, so it pastes into Azure DevOps, Teams or email with lists, colours and table
  borders. Text pasted into the editors keeps its lists, tables and bold but not its colours; scripts, links and
  images are dropped.
- **Better questions**: GapCue now writes each question with its key terms in bold and the story's exact wording in
  "quotes". Older reviews keep working; their comments and questions are converted when they open.

### Fixed
- **Reviews list shows your real progress**: when this browser holds newer decisions than the disk (page opened
  from a file, or not saved yet), the list counts those. Going Back to the list reloads it, and times are in local time.
- **A finished review opens normally**: when every finding is decided, the page opens on All findings at the top
  instead of resuming Step through on the last finding.

## 0.2.0 - 2026-10-14

### Added
- **Update notice on the review page**: the footer shows "Update available: X.Y.Z" when a newer release is out
  (checked at most once a day; `GAPCUE_NO_UPDATE_CHECK=1` turns it off).
- **Buttons** lift on hover and press in on click; Approved / Out of scope pop when turned on.

### Changed
- Highlights and the Gap / Contradiction buttons are brighter in the Light and Paper themes; selected text uses the accent colour.
- The summary cards keep each label on one line ("Contradictions", "Findings to review").

### Fixed
- **Replace no longer loses your work**: rebuilding a review keeps your decisions, reworded questions and own findings,
  and a newer copy saved in your browser still wins. New version now carries reworded questions too.
- **Step through**: closing the popup (Esc or a click outside) brings every highlight back.

## 0.1.0 - 2026-10-14

First public version.

- **Gap analysis**: paste a user story; GapCue lists the gaps and contradictions that block development or testing,
  and skips what your team already asked in the comments.
- **Review page**: the whole story with every finding highlighted. Contradictions are linked with curved arrows,
  each point has a lettered chip, and points off screen get a marker at the edge.
- **Approve / Out of scope** for each finding; approved questions become a ready-to-send comment for the BA.
  The buttons stay visible while you scroll, and ✎ lets you reword any question before you approve it.
- **Add your own findings**: select text → Gap or Contradiction (against another part of the story or something
  outside it), write the question, and it joins the comment. Edit, delete and undo.
- **Themes**: Auto, Light, Dark, Paper and Midnight from the round button at the top; the new theme spreads from
  the button you pick, and your choice is remembered in this browser.
- **Step through** mode to review one finding at a time.
- **Saved reviews**: a reviews folder with versions (new or replace), a history page, and decisions saved to disk.
- **Update notice**: the CLI tells you when a newer GapCue is out (checked at most once a day; `GAPCUE_NO_UPDATE_CHECK=1`
  turns it off), and the review page shows its version with a link to the releases.
- **App mode**: one self-contained HTML file for the Claude and ChatGPT apps, with Download / Load decisions.
