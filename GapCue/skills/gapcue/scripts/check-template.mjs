#!/usr/bin/env node
// Syntax-checks the page script inside assets/template.html and that the versions match (used by RELEASING.md).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "template.html");
const html = fs.readFileSync(file, "utf8");
const m = html.match(/<script>\n([\s\S]*?)<\/script>/);
if (!m) { console.error("✗ no inline <script> found in " + file); process.exit(1); }
if (!html.includes("/*__DATA__*/")) { console.error("✗ the /*__DATA__*/ placeholder is missing"); process.exit(1); }
try { new vm.Script(m[1], { filename: "template.html <script>" }); }
catch (e) { console.error("✗ " + e.message); process.exit(1); }
// the skill's version (SKILL.md) must match the plugin's (Claude Code offers updates by it)
const skill = fs.readFileSync(path.join(path.dirname(file), "..", "SKILL.md"), "utf8").match(/^\s+version:\s*"?([\d.]+)"?\s*$/m)?.[1];
const pj = path.join(path.dirname(file), "..", "..", "..", ".claude-plugin", "plugin.json");
if (!skill) { console.error("✗ no metadata.version in SKILL.md"); process.exit(1); }
if (fs.existsSync(pj) && JSON.parse(fs.readFileSync(pj, "utf8")).version !== skill) { console.error("✗ SKILL.md version " + skill + " ≠ plugin.json version"); process.exit(1); }
console.log("✔ template script parses (" + m[1].split("\n").length + " lines)");
