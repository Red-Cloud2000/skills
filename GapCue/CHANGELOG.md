# Changelog

## Unreleased

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
