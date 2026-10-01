# Most rendered markdown editors rewrite your file on save

Open a markdown file in a rendered (WYSIWYG) editor engine, change nothing, save. This benchmark measures what comes back.

On six realistic reports, **every serializing engine tested changed between 7% and 100% of the lines, and none returned a single file byte-identical.** Several lost content that changes meaning: the GitHub "Caution" banner, frontmatter, footnotes, images, HTML comments, `<details>` blocks, task checkboxes and whole tables. A source editor (CodeMirror 6) with default settings kept LF files intact but rewrote every line of a CRLF file. Saving only the edited ranges back into the original bytes ("patch-on-save") kept all six files byte-identical and confined real edits to the edited lines.

Everything here is reproducible:

```bash
git clone https://github.com/Katta041/markdown-roundtrip-benchmark.git
cd markdown-roundtrip-benchmark
npm ci
npm run bench -- --quick   # a few seconds: all round-trip and edit results, 1 MB timings
npm run bench              # full run, about 3 minutes on a fast laptop: adds 5 MB and 20 MB timings, Milkdown and Tiptap on 1 MB
```

Requires Node 24 or later. The run prints each result and writes `results/results.json`, `results/RESULTS.md` (the tables below) and `results/output/<engine>/<file>`, the exact bytes each engine saved, so you can diff them yourself (for example `git diff --no-index corpus/02-ai-code-audit.md results/output/tiptap/02-ai-code-audit.md`). The committed `results/` files are from the run reported below; `results/output/` is created by your run.

## Method

1. Build the corpus: six simulated reports in `corpus/src/`, turned into byte variants by `corpus/build.mjs` (see [Corpus](#corpus)). `corpus/SHA256SUMS` pins every byte; the harness refuses to run if a file differs.
2. **No-op round trip.** For each file and each engine: load the document the way the engine documents, make no edits, ask for markdown back, and compare with the original bytes. "Lines changed" is the number of original lines that a line diff (`diff` 9.0.0, `diffLines`) marks as removed, as a percentage of all lines. "Words lost" counts word occurrences in the original that are missing from the output.
3. **Constructs.** For specific constructs whose loss changes meaning (alerts, frontmatter, footnotes, tables, images, HTML), a check on each output decides kept or lost. Every check is in `bench.mjs` (`PROBES`) and is verified to hold on the original file first.
4. **Edits.** Realistic edits, issued the way a rendered-view widget would (tick a task, edit a table cell, insert a row, fix a word, insert a paragraph), go through the patch-on-save reference, and the saved file is diffed against the original.
5. **Performance.** Generated reports of 1, 5 and 20 MB, one timed run per operation.

Every dependency is pinned to an exact version in `package.json` and `package-lock.json`.

## Engines tested

| Engine | How it loads and saves | Used by |
|---|---|---|
| remark (unified 11, remark-gfm, remark-frontmatter, remark-math) | Parse to a syntax tree (mdast), serialize with remark-stringify | MDX and many docs and CMS toolchains; Milkdown parses and serializes through remark |
| prosemirror-markdown 1.13 | Parse into a ProseMirror document, serialize with the default serializer | The markdown module of ProseMirror, the base of many rich-text editors |
| marked 18 -> HTML -> turndown 7 (+ GFM plugin) | Render to HTML, convert back to markdown | Editors that keep HTML as the document and convert back on save or paste |
| Milkdown 7.22 (commonmark + gfm presets) | Load into the WYSIWYG editor, read back with `getMarkdown()` | Milkdown and its Crepe editor, and apps built on them |
| Tiptap 3.31 + official `@tiptap/markdown` (StarterKit, tables, task lists) | Load markdown into the editor, read back with `editor.getMarkdown()` | Tiptap-based editors in many web apps |
| CodeMirror 6, naive save | Default `EditorState`, save `doc.toString()` | Source editors built on CodeMirror 6, when they save without handling line endings |
| CodeMirror 6 + patch-on-save (reference) | Keep the original bytes, apply only the edited ranges on save | The reference technique in [`reference/patch-on-save.mjs`](reference/patch-on-save.mjs) |

Exact versions of every package are recorded in `results/RESULTS.md` on each run.

## Corpus

All content is simulated (example domains, fake tokens). Each file packs in the constructs that editors tend to break.

| File | Simulates | Bytes |
|---|---|---|
| `01-pentest-findings.md` | Penetration test report: YAML frontmatter, aligned severity tables, CVSS, HTTP/JSON/Python snippets, task-list remediation, GitHub alerts (`> [!CAUTION]`), `<details>`, footnotes, reference links, escaped pipes in tables, both hard-break styles | LF |
| `02-ai-code-audit.md` | AI agent security review: `<finding>` XML tags with severity attributes, emoji table, diff blocks, nested blockquotes, strikethrough, CJK, Greek, Hebrew and Arabic text | **CRLF + UTF-8 BOM** |
| `03-soc2-audit.md` | SOC 2 readiness assessment: 8-column control matrix, evidence image with title, nested lists with tabs, trailing spaces | **Mixed CRLF/LF** (every third line CRLF) |
| `04-architecture-spec.md` | Design RFC: TOML frontmatter, Mermaid diagrams, inline and block math, `$` in prose, `<dl>`, nested tasks, reference-style image, an HTML reviewer comment | LF |
| `05-llm-chat-export.md` | Chat export: config snippets, tables, Japanese, Chinese and Korean, right-to-left text, literal escape sequences | LF |
| `06-edge-cases.md` | CommonMark torture test: setext headings, `*`/`-`/`+` markers, `7)` and `1. 1. 1.` lists, lazy continuation, entities, every link style, nested fences, pipe-less and unpadded tables, three rule styles | LF, **no final newline** |

The performance files are generated in memory by repeating the findings and audit sections with unique IDs (`stress()` in `corpus/build.mjs`).

## Results

Measured with `npm run bench` on Node 26.0.0, macOS on Apple Silicon (M5).

### A. Load and save with no edits

Percent of lines changed (lower is better; 0 means byte-identical):

| File | remark | prosemirror-md | turndown | Milkdown | Tiptap | CM6 naive | CM6 + patch-on-save |
|---|---:|---:|---:|---:|---:|---:|---:|
| 01 pentest (LF) | 32.5% | 45.4% | 44.8% | 36.2% | 38.7% | 0 | **0** |
| 02 AI audit (CRLF + BOM) | 88.7% | 100% | 100% | 88.7% | 100% | **100%** | **0** |
| 03 SOC 2 (mixed CRLF/LF) | 64.8% | 64.8% | 63.4% | 64.8% | 59.2% | **33.8%** | **0** |
| 04 architecture spec | 14.3% | 37.4% | 38.5% | 18.7% | 25.3% | 0 | **0** |
| 05 chat export | 11.2% | 7.1% | 16.3% | 11.2% | 10.2% | 0 | **0** |
| 06 edge cases (no final newline) | 36.0% | 42.1% | 48.2% | 38.6% | 40.4% | 0 | **0** |
| **Byte-identical files** | 0/6 | 0/6 | 0/6 | 0/6 | 0/6 | 4/6 | **6/6** |

Words lost on the no-op save (word occurrences in the original missing from the output):

| File | remark | prosemirror-md | turndown | Milkdown | Tiptap | CM6 naive | CM6 + patch-on-save |
|---|---:|---:|---:|---:|---:|---:|---:|
| 01 pentest | 3 | 7 | 11 | 7 | 7 | 0 | 0 |
| 02 AI audit | 0 | 0 | 30 | 0 | 6 | 0 | 0 |
| 03 SOC 2 | 0 | 0 | 0 | 0 | 11 | 0 | 0 |
| 04 architecture spec | 2 | 4 | 24 | 10 | 26 | 0 | 0 |
| 05 chat export | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 06 edge cases | 9 | 13 | 22 | 13 | 14 | 0 | 0 |

### What was lost

Checked automatically on every run (the constructs table in `results/RESULTS.md`), and by reading `results/output/`:

| File | Construct | remark | prosemirror-md | turndown | Milkdown | Tiptap | CM6 naive | CM6 + patch-on-save |
|---|---|---|---|---|---|---|---|---|
| 01 | GitHub alert `> [!CAUTION]` still an alert | lost | lost | lost | lost | lost | kept | kept |
| 01 | YAML frontmatter kept on line 1 | kept | lost | lost | lost | lost | kept | kept |
| 01 | footnote `[^idor]` not escaped | kept | lost | lost | kept | lost | kept | kept |
| 01 | footnote definitions kept | kept | lost | lost | kept | lost | kept | kept |
| 01 | `<details>` block kept | kept | kept | lost | kept | lost | kept | kept |
| 01 | every table still a table | kept | lost | kept | kept | kept | kept | kept |
| 01 | every task-list item still a task | kept | lost | lost | kept | kept | kept | kept |
| 02 | 4 `<finding severity=...>` tags kept | kept | kept | lost | kept | lost | kept | kept |
| 02 | UTF-8 BOM kept | lost | kept | kept | lost | kept | kept | kept |
| 02 | CRLF line endings kept | lost | lost | lost | lost | lost | lost | kept |
| 03 | evidence image kept | kept | kept | kept | kept | lost | kept | kept |
| 03 | 8-column control matrix still a table | kept | lost | kept | kept | kept | kept | kept |
| 03 | mixed CRLF/LF kept line by line | lost | lost | lost | lost | lost | lost | kept |
| 04 | TOML frontmatter kept on line 1 | kept | lost | lost | kept | lost | kept | kept |
| 04 | reviewer HTML comment kept | kept | kept | lost | kept | lost | kept | kept |
| 04 | reference-style image kept | kept | kept | kept | lost | lost | kept | kept |
| 04 | `<dl>` definition list kept | kept | kept | lost | kept | lost | kept | kept |
| 04 | `$$` math block kept | kept | lost | lost | kept | kept | kept | kept |
| 06 | pipe-less and unpadded tables still tables | kept | lost | kept | kept | kept | kept | kept |
| 06 | inline `<kbd>`, `<mark>`, `<sup>` kept | kept | kept | lost | kept | lost | kept | kept |
| 06 | no final newline kept | lost | kept | kept | lost | kept | kept | kept |

Examples, from the saved files in `results/output/`:

- **The confidentiality banner disappears.** Every serializing engine escaped the GitHub alert: `> [!CAUTION]` became `> \[!CAUTION]` (or `> \[!CAUTION\]`), so GitHub renders an ordinary quote instead of the red "Caution" box. In a security report, that box is the handling notice.
- **Tiptap** turned the SOC 2 evidence image into the plain text `MFA policy screenshot` and the spec's reference-style image into `latency chart`, removed the `<details>` wrapper, the `<dl>` definitions and the HTML reviewer comment (`<!-- reviewer: please check the RPO claim ... -->`), escaped footnotes (`[^idor]` became `\[^idor\]`, so they render as literal text) turned the YAML frontmatter into a `## title:` heading, and double-escaped entities (`&nbsp;` became `&amp;nbsp;`, which renders as the literal text `&nbsp;`).
- **Milkdown** (default presets) dropped the reference-style image entirely (`Reference-style image: ` is left empty) and logged `Expected value of type string for attribute title on type image, got null` while doing it. It turned the opening `---` of the YAML frontmatter into `***` (a horizontal rule), so the metadata became body text, and stripped the BOM.
- **marked -> turndown** removed all four `<finding id="..." severity="...">` tags from the AI audit (the severity metadata is gone), `<details>`/`<summary>`, `<dl>`, `<kbd>`, `<mark>`, `<sup>` and the reviewer comment, and turned task items into plain bullets (the checkboxes are gone).
- **prosemirror-markdown** has no table node in its default schema: every table in the pentest report and the SOC 2 control matrix was flattened into one paragraph of pipes. It also escaped footnotes and merged their definitions into one paragraph, escaped task checkboxes, and broke both frontmatter blocks and the math block.
- **remark** kept most constructs (it was run with frontmatter, GFM and math plugins) but still changed 11% to 89% of lines: re-padded tables, normalized list markers and hard breaks, escaped the alert, stripped the BOM and left the CRLF file with mixed line endings (13 CRLF, 103 LF).
- **Line endings.** Every engine except patch-on-save changed the line endings of the CRLF file and flattened the mixed file to LF. In a Windows repository this shows up as every line changed in `git diff`.
- **CodeMirror 6 with defaults** is byte-perfect on LF files but rewrites 100% of a CRLF file and a third of the mixed file, because it normalizes line breaks to `\n` and `doc.toString()` joins with `\n`. A source editor needs a save layer too.
- **Reformatting noise** across the serializing engines: tables re-padded (remark, Milkdown and Tiptap), list markers normalized (`+` and `-` to `*` in remark, prosemirror-markdown and Milkdown, to `-   ` in turndown), the `1. 1. 1.` list renumbered to `1. 2. 3.` by all five, hard breaks converted (two trailing spaces to a backslash in remark, prosemirror-markdown and Milkdown, the reverse in turndown and Tiptap), and `&mdash;` turned into the literal character by all but Tiptap.

### B. Edits through patch-on-save

| File | Edits | Lines changed | Lines added | Result |
|---|---|---:|---:|---|
| 01 pentest (LF) | tick a task, edit a table cell (`Open` to `Fixed (retest 2026-09-30)`), insert a sign-off row, fix a word | 3 | 1 | Only the edited lines differ; the cell's padding and pipes are untouched |
| 02 AI audit (CRLF + BOM) | edit a table cell, insert a 2-line paragraph | 1 | 3 | New lines written as CRLF; BOM kept. A naive CodeMirror save would change all 115 lines |
| 03 SOC 2 (mixed CRLF/LF) | tick a task, edit a cell in the 8-column table | 2 | 0 | The 24 CRLF / 47 LF mix kept line by line. A naive save would change 25 lines |
| 06 edge cases (no final newline) | edit a cell in a pipe-less table, edit the last line | 2 | 0 | Still no final newline |

### C. Performance

Milliseconds, one run each, Node 26.0.0 on Apple Silicon (M5):

| Operation | 1 MB | 5 MB | 20 MB |
|---|---:|---:|---:|
| lezer full parse (CodeMirror's markdown parser) | 58 | 217 | 873 |
| CodeMirror 6 state + full syntax tree | 64 | 234 | 892 |
| **patch-on-save (open, 3 edits, save)** | **9** | **52** | **222** |
| markdown-it render | 65 | 381 | 1,216 |
| marked render | 51 | 287 | 906 |
| remark parse | 1,058 | 18,747 | skipped |
| prosemirror-markdown parse | 39 | 184 | skipped |
| Milkdown load + save | 20,596 | skipped | skipped |
| Tiptap load + save | 111,611 | skipped | skipped |

remark grows much faster than linearly on this input (about 1 s at 1 MB, about 19 s at 5 MB). Milkdown and Tiptap run in jsdom here; see the fairness notes before reading their absolute numbers.

## Limitations and fairness notes

- **Default configurations.** Milkdown ran with its commonmark and gfm presets and Tiptap with StarterKit, tables and task lists, without frontmatter, math, footnote or alert extensions. Products built on them often add such plugins, which would fix some construct-level losses (for example frontmatter). They would not remove the reformatting, escaping and line-ending changes, which come from re-serializing the document.
- **Engines, not products.** This measures the engines and their documented load and save calls. Products add their own layers. Typora (closed source), Obsidian and VS Code's rendered editors are GUI applications and were **not tested directly**. Obsidian is built on CodeMirror 6, a source editor, so it is closer to the CodeMirror rows than to the WYSIWYG rows, and it may handle line endings itself.
- **The CodeMirror naive row is a lower bound of care.** CodeMirror 6 can be configured with a `lineSeparator`; an editor that does so would keep uniform CRLF files. A mixed file still needs per-line handling like patch-on-save.
- **jsdom is slower than a browser.** Milkdown and Tiptap ran in jsdom, which is slower than a real browser engine, so treat their absolute times as pessimistic. The gap (about 350 times slower than the source parser at 1 MB for Milkdown, about 1,900 times for Tiptap) is the signal, not the exact number.
- **One run, one machine.** Timings are single runs on one machine and vary by a factor of two between runs. The round-trip, construct and edit results are deterministic.
- **Six files.** The corpus is small and deliberately dense with hard constructs. Plain prose with a few headings round-trips much better in every engine (see file 05).
- **"Lines changed" counts formatting changes too.** Re-padding a table is not content loss, but it makes review and `git diff` noisy, which is the practical cost for people who keep markdown in git.
- **UTF-8 only.** The reference technique and this corpus cover UTF-8. UTF-16 and legacy encodings are not tested.

## Patch-on-save: a reference technique

[`reference/patch-on-save.mjs`](reference/patch-on-save.mjs) is a minimal reference implementation (about 130 lines, MIT) of the technique measured above, not a product and not a complete editor:

1. Keep the file's original bytes. Build a line table with each line's start offset and its own terminator (`\r\n`, `\n`, `\r` or none), and remember the BOM.
2. Let CodeMirror 6 hold the text for editing, with line breaks normalized to `\n`.
3. Record every edit as a CodeMirror `ChangeSet` relative to the loaded document.
4. On save, map each changed range back to an offset in the original string line by line, and splice only those ranges. New line breaks take the terminator of the line being edited, or the file's dominant one.

Everything outside the edited ranges (BOM, per-line endings, trailing spaces, tabs, a missing final newline) is copied from the original bytes. The helpers in `actions` show how rendered-view widgets (task checkbox, table cell, table row) can issue minimal source patches. Its table-cell splitter handles escaped pipes and single-backtick code spans but not every case (double-backtick spans with pipes, HTML inside cells, ragged rows), and new text does not yet adopt the file's list or emphasis style.


## Add an engine

If an editor engine you use is missing, or a configuration is unfair to it, please open a pull request. The adapter interface is a single object with a `roundTrip` function; see [CONTRIBUTING.md](CONTRIBUTING.md).

## How AsItIs uses this

[AsItIs](https://asitis.app) is a markdown editor built on this finding. It edits in a rendered view and saves with patch-on-save, so bytes you did not change stay exactly as they were. This benchmark and its corpus are the kind of check AsItIs runs to hold itself to that.

## License

[MIT](LICENSE). The engines are third-party packages under their own licences, installed from npm.
