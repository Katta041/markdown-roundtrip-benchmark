// Markdown round-trip benchmark: loads each corpus file into each engine, saves it
// with NO edits, and measures what changed. Then makes realistic edits through the
// patch-on-save reference, and times parsers and editors on large files.
//
// Usage: npm run bench [-- --quick]
// Writes results/results.json, results/RESULTS.md and results/output/<engine>/<file>.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(ROOT, "results");
const T0 = performance.now();

const USAGE = `Usage: npm run bench [-- --quick]

  --quick   Skip the 5 MB and 20 MB performance runs and the slow editors
            (Milkdown, Tiptap) in the performance section. The round-trip and
            edit sections always run in full.
  --help    Print this help.`;

function fail(message) {
  console.error(`bench: ${message}`);
  process.exit(2);
}

// ---------- arguments and environment ----------
const args = process.argv.slice(2);
for (const a of args) {
  if (a === "--help" || a === "-h") {
    console.log(USAGE);
    process.exit(0);
  }
  if (a !== "--quick") fail(`unknown option "${a}". Run npm run bench -- --help for usage.`);
}
const QUICK = args.includes("--quick");

const major = Number(process.versions.node.split(".")[0]);
if (major < 24) fail(`Node ${process.versions.node} is too old. This benchmark needs Node 24 or later.`);

let ENGINES, openDoc, save, actions, diffLines, VARIANTS, sha256, stress, CORPUS_DIR;
try {
  await import("./engines/dom.mjs"); // DOM globals first, so every engine sees the same environment
  ({ ENGINES } = await import("./engines/index.mjs"));
  ({ openDoc, save, actions } = await import("./reference/patch-on-save.mjs"));
  ({ diffLines } = await import("diff"));
  ({ VARIANTS, sha256, stress, CORPUS_DIR } = await import("./corpus/build.mjs"));
} catch (e) {
  if (e && (e.code === "ERR_MODULE_NOT_FOUND" || e.code === "MODULE_NOT_FOUND")) fail("dependencies are missing. Run npm ci first.");
  fail(`could not load the engines: ${String(e && e.message ? e.message : e).split("\n")[0]}`);
}

// ---------- corpus check ----------
function loadCorpus() {
  const sumsFile = path.join(CORPUS_DIR, "SHA256SUMS");
  if (!fs.existsSync(sumsFile)) fail("corpus/SHA256SUMS is missing. Run npm run corpus to rebuild the corpus.");
  const expected = new Map(
    fs.readFileSync(sumsFile, "utf8").trim().split("\n").map((l) => {
      const [sum, name] = l.trim().split(/\s+/);
      return [name, sum];
    }),
  );
  return VARIANTS.map((v) => {
    const file = path.join(CORPUS_DIR, v.file);
    if (!fs.existsSync(file)) fail(`corpus/${v.file} is missing. Run npm run corpus to rebuild the corpus.`);
    const buf = fs.readFileSync(file);
    if (sha256(buf) !== expected.get(v.file)) {
      fail(`corpus/${v.file} does not match corpus/SHA256SUMS; git may have converted its line endings. Re-clone with core.autocrlf=false, or run npm run corpus.`);
    }
    return { file: v.file, bytes: v.bytes, buf };
  });
}
const corpus = loadCorpus();

// ---------- helpers ----------
const BOM = "﻿";
const splitKeep = (s) => s.match(/[^\r\n]*(\r\n|\r|\n|$)/g).filter((x, i, a) => x !== "" || i < a.length - 1);
const eolProfile = (s) => ({ crlf: (s.match(/\r\n/g) || []).length, lf: (s.match(/(?<!\r)\n/g) || []).length, cr: (s.match(/\r(?!\n)/g) || []).length });
function changedLines(a, b) {
  let removed = 0, added = 0;
  for (const part of diffLines(a, b)) {
    if (part.removed) removed += part.count;
    if (part.added) added += part.count;
  }
  return { removed, added };
}
function words(s) {
  const m = new Map();
  for (const w of s.match(/[\p{L}\p{N}]+/gu) || []) m.set(w, (m.get(w) || 0) + 1);
  return m;
}
function lostWords(a, b) {
  const wa = words(a), wb = words(b);
  let lost = 0;
  const examples = [];
  for (const [w, n] of wa) {
    const d = n - (wb.get(w) || 0);
    if (d > 0) {
      lost += d;
      if (examples.length < 6) examples.push(w);
    }
  }
  return { wordsLost: lost, wordsLostExamples: examples };
}
const stripBom = (s) => (s.startsWith(BOM) ? s.slice(1) : s);
function frontmatterKept(orig, out) {
  const fm = /^(---|\+\+\+)\r?\n[\s\S]*?\r?\n\1\r?\n/.exec(stripBom(orig));
  if (!fm) return null;
  return stripBom(out).replace(/\r\n/g, "\n").startsWith(fm[0].replace(/\r\n/g, "\n"));
}
const count = (s, needle) => s.split(needle).length - 1;
const mathFences = (s) => s.split(/\r\n|\r|\n/).filter((l) => l.trim() === "$$").length;
const lines = (s) => s.split(/\r\n|\r|\n/);
const tableSeparators = (s) => lines(s).filter((l) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(l)).length;
const taskItems = (s) => lines(s).filter((l) => /^\s*[-*+] \[[ xX]\] /.test(l)).length;

/** Runs fn while capturing console output and unhandled rejections, so engine noise does not flood the terminal. */
async function quietly(fn) {
  const saved = {};
  const messages = [];
  for (const k of ["log", "info", "warn", "error", "debug"]) {
    saved[k] = console[k];
    console[k] = (...a) => messages.push(a.map((x) => (x instanceof Error ? x.message : String(x))).join(" ").split("\n")[0].slice(0, 160));
  }
  const onRejection = (r) => messages.push(`unhandled rejection: ${String(r && r.message ? r.message : r).slice(0, 140)}`);
  process.on("unhandledRejection", onRejection);
  try {
    return { value: await fn(), messages };
  } finally {
    await new Promise((r) => setTimeout(r, 0));
    process.off("unhandledRejection", onRejection);
    Object.assign(console, saved);
  }
}

const ms = (t) => Math.round(performance.now() - t);
const safeDir = (id) => id.replace(/[^a-z0-9-]+/gi, "-");
function writeOut(rel, buf) {
  const file = path.join(RESULTS, "output", rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}
function versionOf(pkg) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules", pkg, "package.json"), "utf8")).version;
  } catch {
    return "not installed";
  }
}

// Specific constructs whose loss changes meaning, checked on every engine's output.
const PROBES = [
  { file: "01-pentest-findings.md", label: "GitHub alert `> [!CAUTION]` still an alert", test: (o) => o.includes("> [!CAUTION]") },
  { file: "01-pentest-findings.md", label: "YAML frontmatter kept on line 1", test: (o, i) => frontmatterKept(i, o) },
  { file: "01-pentest-findings.md", label: "footnote `[^idor]` not escaped", test: (o) => o.includes("[^idor]") && !o.includes("\\[^idor") },
  { file: "01-pentest-findings.md", label: "footnote definitions kept", test: (o) => o.includes("[^idor]:") && o.includes("[^wstg]:") },
  { file: "01-pentest-findings.md", label: "`<details>` block kept", test: (o) => o.includes("<details>") },
  { file: "01-pentest-findings.md", label: "every table still a table", test: (o, i) => tableSeparators(o) === tableSeparators(i) },
  { file: "01-pentest-findings.md", label: "every task-list item still a task", test: (o, i) => taskItems(o) === taskItems(i) },
  { file: "02-ai-code-audit.md", label: "4 `<finding severity=...>` tags kept", test: (o) => count(o, '<finding id="') === 4 && o.includes('severity="high"') },
  { file: "02-ai-code-audit.md", label: "UTF-8 BOM kept", test: (o) => o.startsWith(BOM) },
  { file: "02-ai-code-audit.md", label: "CRLF line endings kept", test: (o, i) => JSON.stringify(eolProfile(o)) === JSON.stringify(eolProfile(i)) },
  { file: "03-soc2-audit.md", label: "evidence image kept", test: (o) => o.includes("![MFA policy screenshot](evidence/cc6/mfa.png") },
  { file: "03-soc2-audit.md", label: "8-column control matrix still a table", test: (o, i) => tableSeparators(o) === tableSeparators(i) },
  { file: "03-soc2-audit.md", label: "mixed CRLF/LF kept line by line", test: (o, i) => JSON.stringify(eolProfile(o)) === JSON.stringify(eolProfile(i)) },
  { file: "04-architecture-spec.md", label: "TOML frontmatter kept on line 1", test: (o, i) => frontmatterKept(i, o) },
  { file: "04-architecture-spec.md", label: "reviewer HTML comment kept", test: (o) => o.includes("<!-- reviewer: please check the RPO claim") },
  { file: "04-architecture-spec.md", label: "reference-style image kept", test: (o) => o.includes("![latency chart]") },
  { file: "04-architecture-spec.md", label: "`<dl>` definition list kept", test: (o) => o.includes("<dl>") },
  { file: "04-architecture-spec.md", label: "`$$` math block kept", test: (o, i) => mathFences(o) === mathFences(i) },
  { file: "06-edge-cases.md", label: "inline `<kbd>`, `<mark>`, `<sup>` kept", test: (o) => ["<kbd>", "<mark>", "<sup>"].every((t) => o.includes(t)) },
  { file: "06-edge-cases.md", label: "pipe-less and unpadded tables still tables", test: (o, i) => tableSeparators(o) === tableSeparators(i) },
  { file: "06-edge-cases.md", label: "no final newline kept", test: (o) => !/[\r\n]$/.test(o) },
];

const results = {
  meta: {
    generatedAt: new Date().toISOString(),
    mode: QUICK ? "quick" : "full",
    node: process.versions.node,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model ?? "unknown",
    engines: ENGINES.map((e) => ({ id: e.id, name: e.name, approach: e.approach, usedBy: e.usedBy, packages: Object.fromEntries(e.packages.map((p) => [p, versionOf(p)])) })),
  },
  roundtrip: [],
  probes: [],
  edits: [],
  perf: [],
};

// ---------- A. load and save with no edits ----------
console.log(`Markdown round-trip benchmark (${results.meta.mode}), Node ${process.versions.node}, ${results.meta.platform}\n`);
console.log("A. Load and save with NO edits");
fs.rmSync(path.join(RESULTS, "output"), { recursive: true, force: true });
const outputs = new Map();
for (const { file, buf } of corpus) {
  const orig = buf.toString("utf8");
  const linesTotal = splitKeep(orig).length;
  for (const engine of ENGINES) {
    const t = performance.now();
    let out, error;
    const run = await quietly(async () => {
      try {
        return await engine.roundTrip(engine.input === "bytes" ? buf : orig);
      } catch (e) {
        error = String(e && e.message ? e.message : e).split("\n")[0].slice(0, 160);
        return undefined;
      }
    });
    const elapsed = ms(t);
    const row = { file, engine: engine.id, ms: elapsed, engineMessages: run.messages.slice(0, 5), engineMessageCount: run.messages.length };
    if (error !== undefined || run.value === undefined || run.value === null) {
      Object.assign(row, { error: error ?? "returned nothing" });
      results.roundtrip.push(row);
      console.log(`  ${file.padEnd(26)} ${engine.id.padEnd(22)} ERROR ${row.error}`);
      continue;
    }
    const outBuf = Buffer.isBuffer(run.value) ? run.value : Buffer.from(String(run.value), "utf8");
    out = outBuf.toString("utf8");
    outputs.set(`${engine.id}/${file}`, out);
    writeOut(path.join(safeDir(engine.id), file), outBuf);
    const { removed } = changedLines(orig, out);
    Object.assign(row, {
      identical: outBuf.equals(buf),
      linesTotal,
      linesChanged: removed,
      pctChanged: +((100 * removed) / linesTotal).toFixed(1),
      bytesIn: buf.length,
      bytesOut: outBuf.length,
      eolIn: eolProfile(orig),
      eolOut: eolProfile(out),
      ...lostWords(orig, out),
    });
    results.roundtrip.push(row);
    console.log(`  ${file.padEnd(26)} ${engine.id.padEnd(22)} ${row.identical ? "byte-identical" : `${row.pctChanged}% of lines changed, ${row.wordsLost} words lost`}`);
  }
}

for (const p of PROBES) {
  const orig = corpus.find((c) => c.file === p.file).buf.toString("utf8");
  const row = { file: p.file, probe: p.label, original: !!p.test(orig, orig), engines: {} };
  for (const engine of ENGINES) {
    const out = outputs.get(`${engine.id}/${p.file}`);
    row.engines[engine.id] = out === undefined ? "error" : p.test(out, orig) ? "kept" : "lost";
  }
  if (!row.original) fail(`probe "${p.label}" does not hold on the original ${p.file}; the corpus or the probe is wrong.`);
  results.probes.push(row);
}

// ---------- B. real edits through patch-on-save ----------
console.log("\nB. Edits through the patch-on-save reference");
const EDIT_PLANS = {
  "01-pentest-findings.md": [
    ["tick a task", (d) => actions.toggleTask(d, "Enforce object-level")],
    ["edit a table cell (Open to Fixed)", (d) => actions.editCell(d, "| Status     |", 1, "Fixed (retest 2026-09-30)")],
    ["insert a table row", (d) => actions.insertRowAfter(d, "| QA reviewer |", ["Client approver", "M. Tan", "2026-09-30"])],
    ["fix a word", (d) => actions.replaceText(d, "481 valid reports", "481 valid settlement reports")],
  ],
  "02-ai-code-audit.md": [
    ["edit a table cell", (d) => actions.editCell(d, "ts/path-traversal", 6, "accepted risk")],
    ["insert a 2-line paragraph", (d) => actions.insertParagraphAfter(d, "Fix: resolve and verify the prefix:", "Reviewer note: confirmed on staging.\nTicket SEC-2231 raised.")],
  ],
  "03-soc2-audit.md": [
    ["tick a task", (d) => actions.toggleTask(d, "break-glass")],
    ["edit a cell in an 8-column table", (d) => actions.editCell(d, "CC6.3", 6, "Pass (remediated)")],
  ],
  "06-edge-cases.md": [
    ["edit a cell in a pipe-less table", (d) => actions.editCell(d, "left | center", 1, "middle")],
    ["edit the last line", (d) => actions.replaceText(d, "Final line without trailing newline", "Final line, edited, still no trailing newline")],
  ],
};
for (const [file, plan] of Object.entries(EDIT_PLANS)) {
  const buf = corpus.find((c) => c.file === file).buf;
  const orig = buf.toString("utf8");
  const doc = openDoc(buf);
  for (const [, fn] of plan) fn(doc);
  const saved = save(doc);
  const s = saved.toString("utf8");
  const { removed, added } = changedLines(orig, s);
  const naive = changedLines(orig, doc.state.doc.toString());
  const row = {
    file,
    edits: plan.map((p) => p[0]),
    linesChanged: removed,
    linesAdded: added - removed,
    bomKept: orig.startsWith(BOM) ? s.startsWith(BOM) : null,
    eolBefore: eolProfile(orig),
    eolAfter: eolProfile(s),
    finalNewlineKept: /[\r\n]$/.test(orig) === /[\r\n]$/.test(s),
    naiveSaveLinesChanged: naive.removed,
  };
  results.edits.push(row);
  writeOut(path.join("edits", file), saved);
  console.log(`  ${file.padEnd(26)} ${plan.length} edits: ${removed} line(s) changed, ${row.linesAdded} added; a naive save would change ${naive.removed}`);
}

// ---------- C. performance ----------
console.log(`\nC. Performance${QUICK ? " (quick: 1 MB only, slow editors skipped)" : ""}`);
const { parser: lezerBase, GFM } = await import("@lezer/markdown");
const lezer = lezerBase.configure([GFM]);
const MarkdownIt = (await import("markdown-it")).default;
const { marked } = await import("marked");
const { unified } = await import("unified");
const remarkParse = (await import("remark-parse")).default;
const remarkGfm = (await import("remark-gfm")).default;
const { defaultMarkdownParser } = await import("prosemirror-markdown");
const { EditorState } = await import("@codemirror/state");
const { markdown } = await import("@codemirror/lang-markdown");
const { ensureSyntaxTree } = await import("@codemirror/language");
const milkdown = ENGINES.find((e) => e.id === "milkdown");
const tiptap = ENGINES.find((e) => e.id === "tiptap");

// Each operation: the largest size (MB) it runs at in a full run, and whether --quick skips it.
const PERF = [
  ["lezer full parse", 20, false, (md) => lezer.parse(md)],
  ["CodeMirror 6 state + full syntax tree", 20, false, (md) => { const st = EditorState.create({ doc: md, extensions: [markdown()] }); ensureSyntaxTree(st, st.doc.length, 60000); }],
  ["patch-on-save (open, 3 edits, save)", 20, false, (md, buf) => { const d = openDoc(buf); actions.replaceText(d, "Batch 1\n", "Batch one\n"); actions.toggleTask(d, "UUIDv7"); actions.replaceText(d, "Pipe test", "Pipe check"); save(d); }],
  ["markdown-it render", 20, false, (md) => new MarkdownIt().render(md)],
  ["marked render", 20, false, (md) => marked.parse(md)],
  ["remark parse", 5, false, (md) => { const p = unified().use(remarkParse).use(remarkGfm); p.runSync(p.parse(md)); }],
  ["prosemirror-markdown parse", 5, false, (md) => defaultMarkdownParser.parse(md)],
  ["Milkdown load + save", 1, true, (md) => quietly(() => milkdown.roundTrip(md))],
  ["Tiptap load + save", 1, true, (md) => quietly(() => tiptap.roundTrip(md))],
];
const SIZES = QUICK ? [1] : [1, 5, 20];
for (const [op, maxMb, slow] of PERF) results.perf.push({ operation: op, ms: Object.fromEntries(SIZES.map((mb) => [`${mb}MB`, null])) });
for (const mb of SIZES) {
  const buf = stress(mb);
  const md = buf.toString("utf8");
  for (const [i, [op, maxMb, slow, fn]] of PERF.entries()) {
    const cell = results.perf[i].ms;
    if (mb > maxMb || (QUICK && slow)) {
      cell[`${mb}MB`] = "skipped";
      continue;
    }
    const t = performance.now();
    await fn(md, buf);
    cell[`${mb}MB`] = ms(t);
    console.log(`  ${`${mb} MB`.padEnd(6)} ${op.padEnd(40)} ${cell[`${mb}MB`].toLocaleString("en-US")} ms`);
  }
}

// ---------- write results ----------
results.meta.totalSeconds = +((performance.now() - T0) / 1000).toFixed(1);
fs.mkdirSync(RESULTS, { recursive: true });
fs.writeFileSync(path.join(RESULTS, "results.json"), JSON.stringify(results, null, 2) + "\n");
fs.writeFileSync(path.join(RESULTS, "RESULTS.md"), renderMarkdown(results));
console.log(`\nWrote results/results.json, results/RESULTS.md and results/output/`);
console.log(`Total run time: ${results.meta.totalSeconds} s`);

function renderMarkdown(r) {
  const E = r.meta.engines;
  const L = [];
  const table = (head, rows, align) => {
    L.push(`| ${head.join(" | ")} |`);
    L.push(`|${align.map((a) => (a === "r" ? "---:" : "---")).join("|")}|`);
    for (const row of rows) L.push(`| ${row.join(" | ")} |`);
    L.push("");
  };
  L.push("# Results", "");
  L.push(`Mode: ${r.meta.mode}. Node ${r.meta.node}, ${r.meta.platform}, ${r.meta.cpu}. Generated by \`npm run bench\`; do not edit by hand.`, "");
  L.push("## Engines", "");
  table(["Engine", "Packages"], E.map((e) => [e.name, Object.entries(e.packages).map(([p, v]) => `${p} ${v}`).join(", ")]), ["l", "l"]);

  L.push("## A. Load and save with no edits", "", "Percent of lines changed (0 means byte-identical).", "");
  const cellFor = (file, id) => {
    const x = r.roundtrip.find((y) => y.file === file && y.engine === id);
    if (!x || x.error) return "error";
    return x.identical ? "**0 (identical)**" : x.pctChanged === 0 ? "0 (bytes differ)" : `${x.pctChanged}%`;
  };
  const files = [...new Set(r.roundtrip.map((x) => x.file))];
  const rows = files.map((f) => [`${f} (${corpus.find((c) => c.file === f).bytes})`, ...E.map((e) => cellFor(f, e.id))]);
  rows.push(["**Byte-identical files**", ...E.map((e) => `${r.roundtrip.filter((x) => x.engine === e.id && x.identical).length}/${files.length}`)]);
  table(["File", ...E.map((e) => e.name)], rows, ["l", ...E.map(() => "r")]);

  L.push("Words lost (word occurrences in the original that are missing from the output):", "");
  table(["File", ...E.map((e) => e.name)], files.map((f) => [f, ...E.map((e) => { const x = r.roundtrip.find((y) => y.file === f && y.engine === e.id); return !x || x.error ? "error" : String(x.wordsLost); })]), ["l", ...E.map(() => "r")]);

  const noisy = r.roundtrip.filter((x) => x.engineMessageCount > 0 || x.error);
  if (noisy.length) {
    L.push("Engine errors and console messages during the round trip:", "");
    for (const x of noisy) L.push(`- ${x.engine} on ${x.file}: ${x.error ? `error: ${x.error}` : `${x.engineMessageCount} message(s), first: ${x.engineMessages[0]}`}`);
    L.push("");
  }

  L.push("## Constructs kept or lost", "");
  table(["File", "Construct", ...E.map((e) => e.name)], r.probes.map((p) => [p.file, p.probe, ...E.map((e) => (p.engines[e.id] === "kept" ? "kept" : p.engines[e.id] === "lost" ? "**lost**" : "error"))]), ["l", "l", ...E.map(() => "l")]);

  L.push("## B. Edits through patch-on-save", "");
  table(
    ["File", "Edits", "Lines changed", "Lines added", "BOM kept", "Line endings before -> after", "Final newline state kept", "Naive save would change"],
    r.edits.map((x) => [x.file, x.edits.join("; "), x.linesChanged, x.linesAdded, x.bomKept === null ? "no BOM" : x.bomKept ? "yes" : "**no**", `${x.eolBefore.crlf} CRLF, ${x.eolBefore.lf} LF -> ${x.eolAfter.crlf} CRLF, ${x.eolAfter.lf} LF`, x.finalNewlineKept ? "yes" : "**no**", `${x.naiveSaveLinesChanged} lines`]),
    ["l", "l", "r", "r", "l", "l", "l", "r"],
  );

  L.push("## C. Performance (milliseconds, one run each)", "");
  const sizes = Object.keys(r.perf[0].ms);
  table(["Operation", ...sizes.map((s) => s.replace("MB", " MB"))], r.perf.map((p) => [p.operation, ...sizes.map((s) => (typeof p.ms[s] === "number" ? p.ms[s].toLocaleString("en-US") : "skipped"))]), ["l", ...sizes.map(() => "r")]);
  L.push(`Total run time: ${r.meta.totalSeconds} s.`, "");
  return L.join("\n");
}
