---
name: gapcue
description: GapCue analyses a user story or requirement for the important gaps, ambiguities and contradictions, then shows the whole story as an interactive review page (highlighted findings, linked contradictions with arrows, approve / out-of-scope, the reviewer's own findings, a ready-to-send comment for the BA). Reviews are saved with versions and a history page. Use when the user pastes a story (title, description, acceptance criteria, comments, screenshots) and asks for gap analysis, requirement analysis, a story review, or questions for the BA, or asks to reopen old story reviews.
metadata:
  version: "0.2.0"
---

# GapCue

Two jobs, in order: **analyse the story yourself**, then **show it on an interactive review page**.
No delegation and no second reviewer.

## 0. Where am I running?

Decide by what you can do, not by folder names:

- **Local mode**: you can run `node` (18+) on the user's own computer and they can open a browser there
  (Claude Code, Codex, Cursor, Gemini CLI, other CLIs). Use steps 4–7: ask where to save, versions, local server, history.
- **App mode**: you run in a cloud sandbox (Claude app, ChatGPT, or anything where the user can't reach your files
  directly). Skip steps 4–6. In step 7, build **one self-contained HTML file** (`--single-file`) into the folder the
  environment uses for files it gives back to the user, share that file, and tell the user to **download it and open it
  in a browser** (an in-app preview may block its buttons). Decisions are kept in their browser; the page has
  **Download decisions** / **Load decisions** buttons to keep or move them.
- **No `node` at all**: tell the user GapCue's page needs Node, and give the analysis as JSON (step 2) only.

## 1. Collect the input

Everything the user sent counts as the story: ID, title, description (all sections), acceptance criteria,
discussion / work-item comments, and screenshots. For screenshots, use the file paths the chat gives
(for example `[Image: source: <path>]`). If no path is given, skip the image.

## 2. Gap analysis (do it yourself)

Read the story as a senior test analyst and business analyst. Check:

- clarity and completeness (vague statements, missing scenarios, undefined flows)
- consistency (contradictions inside the story, between sections, between the story and comments/designs)
- testability (unmeasurable rules, missing expected results)
- business rules (unclear rules, gaps in the user flow, unclear data source or ownership)
- data and fields (missing type/format/mandatory info, unclear entity relationships)
- high-risk edge cases

**Report only what matters**, meaning anything that blocks development or testing or leaves a business decision open.
Do not include:
- anything already raised in the story's discussion comments (don't repeat a request the team already made)
- defaults QA or developers can decide alone (trimming spaces, exact boundary inclusiveness, error timing)
- technical details (double-click handling, upload races, caching)
- speculative extras the story never hints at (new fields, checksums, audit, retention)

Most stories need about 8–14 findings. Mark a finding as **contradiction** only when two or more statements in the
input really conflict. Everything else is a **gap**.

If this story has an earlier GapCue review (step 5 says `exists`), read the latest `state.json` in it first: its `custom`
list holds findings **the reviewer added by hand**. Treat them as the reviewer's concerns (not as facts): don't repeat
them, and use them as hints for what this reviewer cares about.

Show the result in chat first as JSON with this exact shape:
`{"gaps":["..."],"questions":["..."]}`

## 3. Write the story JSON

Write `<scratchpad>/<id>-story.json` following [examples/sample.json](examples/sample.json). Schema:

```jsonc
{
  "id": "FD-12", "title": "Add a Delivery Address", "titleAr": "optional Arabic title",
  "meta": { "Product": "...", "Type": "..." },            // chips under the title
  "navigation": ["App", "...", "Add new address"],        // optional breadcrumb, last = current
  "steps": [{ "en": "...", "ar": "...", "state": "done|now" }],  // optional stepper, if the story/design shows one
  "intro": "optional opening of the BA comment",          // default: "Hi team,\nKindly help us clarify the following points on <id> (<title>):"
  "sections": [{ "heading": "Description", "eyebrow": "Sections 1 – 6", "html": "..." }],
  "images": [{ "path": "C:/abs/or/relative/to/json.png", "caption": "..." }],
  "findings": [{
    "id": "max-addresses", "kind": "contra|gap", "title": "short title",
    "why": "what is wrong, plain sentences",
    "q": "the question for the BA (this becomes the comment bullet)",
    "anchors": [{ "text": "exact story text", "label": "Business rules", "in": "#optional-id" }]
  }]
}
```

Rules:
- **Keep the user's text word for word.** Restructure it but do not rewrite it. Typos stay.
- Usual sections: Description, Acceptance criteria, Discussion. Add others only if the input has them.
- `html` uses single-quoted attributes and only these classes (the template styles them):
  `block` + `h3 > span.n` (numbered sub-section) · `scope` > `box` > `h4` + `ul` (in/out of scope) ·
  `tablewrap` > `table` (field tables; `span.ar[lang=ar]` for Arabic names, `td.req` for required) ·
  `scen` > `article.sc` > `h4 > span.n` + `p` with `span.kw` for Given/When/Then/And (scenarios) · `ul.flist` (field lists) ·
  `comment` > `div.avatar` + `div.bubble` (discussion comments). Wrap Arabic in `lang='ar'` (and `dir='rtl'` for full sentences).
- **Anchors** are exact substrings of the rendered text. Case and whitespace are ignored, and a tag boundary counts as a space.
  The first unmarked match is highlighted. If the same text appears more than once, put an `id` on the element
  in `html` and set `"in": "#that-id"`. A contradiction needs ≥2 anchors, one per conflicting statement, each with a `label`.
  Highlights can't overlap: two findings must not anchor on the same words (or one inside the other). Pick a different
  part of the sentence for the second one, or make it a general finding.
  A finding with no anchor found goes into a "General findings" list (still works, just without arrows).
  Fix every `anchor not found` and `anchor overlaps` warning the build prints, then rerun.

## 4. Ask where to save (local mode, every run)

Ask with AskUserQuestion. Don't assume:

**"Where should I save this review?"**
- **Your user folder**: `~/gapcue-reviews` (all your reviews in one place, on this PC only)
- **This project folder**: `<cwd>/gapcue-reviews` (stays with the project and can be shared through git). If they want a
  different project, they can close the session and reopen it in that folder, or choose the next option.
- **A specific path**: the user types the folder path (the "Other" answer)

The chosen folder is the reviews **root** (`--root`).

## 5. Check if this story was reviewed before (local mode)

```bash
node "<skill-dir>/scripts/review.mjs" --status "<scratchpad>/<id>-story.json" --root "<root>"
```

If it prints `exists: ...`, ask with AskUserQuestion: **"<ID> was already reviewed (v1…vN). What should I do?"**
- **New version**: keep the old review and add v(N+1). Decisions, reworded questions and the reviewer's own findings carry over.
- **Replace the old one**: rebuild vN in place. Decisions, reworded questions and own findings for findings that still exist are kept (a copy of the old decisions is also saved as `state.prev.json`).

Map the answer to `--mode new` or `--mode replace`. If it prints `new: ...`, don't ask and don't pass `--mode`.

## 6. Build, serve and open (local mode)

Run this in the background (it keeps serving):

```bash
node "<skill-dir>/scripts/review.mjs" "<scratchpad>/<id>-story.json" --root "<root>" [--mode new|replace]
# --port 8765   --no-open   --build-only
```

It saves the review into `<root>/<ID>/v<N>/`, prints `anchor not found [...]` warnings (fix the anchor text and rerun),
updates the history page, serves `http://127.0.0.1:8765/` and opens the browser on the new review. If a GapCue server
for the same root is already running, it reuses it. If something else is on the port, it picks a free one. Exit code 3
means the story exists and `--mode` is missing, so go back to step 5. Give the user the review URL and the folder path.
If the output has an `update available:` line, tell the user once, at the end, with the update command for how they
installed GapCue (it checks at most once a day; `GAPCUE_NO_UPDATE_CHECK=1` turns it off).

## 7. App mode build

```bash
node "<skill-dir>/scripts/review.mjs" "<scratchpad>/<id>-story.json" --single-file --out "<output folder>"
```

It writes `<ID>-review.html` with the images embedded. Share that file with the user.

## Saved files and history (local mode)

```
<root>/index.html              history of every review: progress, date, links to older versions
<root>/<ID>/v<N>/index.html    the review page
<root>/<ID>/v<N>/story.json    story + findings
<root>/<ID>/v<N>/state.json    decisions, the reviewer's own findings, BA comment (state.js = same data for opening as a file)
<root>/<ID>/v<N>/img/          screenshots
```

- **Reopen old reviews:** `node "<skill-dir>/scripts/review.mjs" --serve --root "<root>"` opens the history page.
  When the user asks for "my old reviews" or "the review of <ID>", ask for the root if it isn't known, then run this.
- **Without the server:** double-click `<root>/index.html` or any review's `index.html`. Decisions made this way stay
  in that browser and are written to disk the next time the review is opened through the server.
- **Server stopped** (closed terminal, low memory): nothing is lost. Decisions are already on disk, so run `--serve` again.
- **Sharing:** zip or commit the story's folder. Teammates see the same decisions.

## Page behaviour (for reference when the user asks)

- Gaps are highlighted amber and contradictions red. Clicking one opens a popup with the problem, the BA question,
  and **Approved** / **Out of scope** buttons (click again to clear). It closes with ×, Esc, or a click outside it.
- Each highlighted point has a lettered chip and a curved arrow into the popup. Points off screen or behind the popup
  get a small marker at the edge. The bottom bar switches between **All findings** and **Step through** (‹ › or ←/→).
- **Add your own finding:** select text in the story → **＋ Gap** or **⇄ Contradiction** (keys G / C). A contradiction can
  point to another part of the story (select it next) or to something outside it (where + quote). Write the question
  (starters help) → **Add to comment**. Own findings show a "you" tag and can be edited or deleted (with Undo).
- Approved questions become bullets in the BA comment. The comment is read-only until **Edit**. **Copy**,
  **Rebuild from approvals**, **Download decisions** and **Load decisions** are next to it.
- The bottom bar shows where decisions are saved ("Saved to disk" or "Saved in this browser").
