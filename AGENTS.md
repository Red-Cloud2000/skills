# Rules for agents working in this repo

This repo (`Red-Cloud2000/skills`) holds agent skills. Each skill is a Claude Code plugin folder (for example `GapCue/`)
with the skill itself in `<Plugin>/skills/<name>/`.

## Before releasing or pushing any update

**Follow [RELEASING.md](RELEASING.md) step by step, in order.**
- Report each step's result as ✓ or ✗ with one line of evidence (command output, file name, link).
- Never skip a step. If a step fails, stop and tell the user what failed. Don't work around it.
- Never push, tag, create a GitHub release, or change repo visibility without the user's explicit "yes" in this conversation.

## Always
- Edit skills here (`D:\My_Skills\...`). On the owner's PC, `~/.claude/skills/gapcue` is a junction to
  `GapCue/skills/gapcue`, so edits apply immediately (start a new session to reload SKILL.md).
- Never commit client material (real stories, screenshots, names). Private test data lives outside this repo
  (`D:\GapCue-private\`). The public example is `GapCue/skills/gapcue/examples/sample.json`.
- The version lives in two places that must match: `version` in `<Plugin>/.claude-plugin/plugin.json` and
  `metadata.version` in the skill's `SKILL.md` (`check-template.mjs` checks this).
