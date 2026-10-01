// Patch-on-save: a REFERENCE TECHNIQUE, not a product and not a complete editor.
// MIT licensed, see LICENSE. It shows how an editor can save markdown without
// rewriting bytes the user did not touch.
//
// The file's original bytes are the source of truth. CodeMirror 6 holds the text
// (with line breaks normalized to \n). Edits are composed into one ChangeSet
// relative to the loaded doc and applied to the ORIGINAL string, mapping positions
// back to original offsets line by line. Untouched bytes (BOM, CRLF/LF/CR per line,
// trailing spaces, tabs, a missing final newline) are never rewritten.
//
// Known gaps of this reference: UTF-8 only (no UTF-16 or legacy encodings); the
// table-cell splitter in `actions` handles escaped pipes and single-backtick code
// spans but not every case (double-backtick spans with pipes, HTML in cells,
// ragged rows); newly typed text does not adopt the file's list or emphasis style.
import { EditorState, ChangeSet } from "@codemirror/state";

const BOM = "\uFEFF";

export function openDoc(buf) {
  let text = buf.toString("utf8");
  const hasBom = text.startsWith(BOM);
  if (hasBom) text = text.slice(1);

  // Line table in original coordinates: start offset and terminator of each line.
  const lines = [];
  const re = /\r\n|\r|\n/g;
  let last = 0, m;
  while ((m = re.exec(text))) { lines.push({ start: last, eol: m[0] }); last = m.index + m[0].length; }
  lines.push({ start: last, eol: "" });

  const counts = { "\n": 0, "\r\n": 0, "\r": 0 };
  for (const l of lines) if (l.eol) counts[l.eol]++;
  const dominantEol = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : "\n";

  const state = EditorState.create({ doc: text });
  return { original: text, hasBom, lines, dominantEol, state, changes: ChangeSet.empty(state.doc.length) };
}

// Apply an edit (a CM TransactionSpec "changes" value) and remember it.
export function edit(doc, changes) {
  const tr = doc.state.update({ changes });
  doc.changes = doc.changes.compose(tr.changes);
  doc.state = tr.state;
  return doc;
}

// Map a position in the ORIGINAL CM doc (\n-normalized) to an offset in the original string.
function toOriginal(doc, startDoc, pos) {
  const line = startDoc.lineAt(pos);
  return doc.lines[line.number - 1].start + (pos - line.from);
}

export function save(doc) {
  const startDoc = EditorState.create({ doc: doc.original }).doc;
  let out = "", cursor = 0;
  doc.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    const a = toOriginal(doc, startDoc, fromA);
    const b = toOriginal(doc, startDoc, toA);
    // New text uses the line ending of the line being edited, else the file's dominant EOL.
    const eol = doc.lines[startDoc.lineAt(fromA).number - 1].eol || doc.dominantEol;
    out += doc.original.slice(cursor, a) + inserted.toString().replace(/\n/g, eol);
    cursor = b;
  });
  out += doc.original.slice(cursor);
  return Buffer.from((doc.hasBom ? BOM : "") + out, "utf8");
}

// Helpers that simulate rendered-view widget actions as minimal source patches.
// The benchmark uses them to make realistic edits.
export const actions = {
  // Toggle the first task item whose text contains `label`.
  toggleTask(doc, label) {
    const text = doc.state.doc.toString();
    const re = /^(\s*[-*+] \[)([ xX])(\] .*)$/gm;
    let m;
    while ((m = re.exec(text))) if (m[3].includes(label)) {
      const pos = m.index + m[1].length;
      return edit(doc, { from: pos, to: pos + 1, insert: m[2] === " " ? "x" : " " });
    }
    throw new Error("task not found: " + label);
  },
  // Replace the text of a table cell (row identified by `rowMatch`, 0-based column) without touching pipes or padding.
  editCell(doc, rowMatch, col, value) {
    const d = doc.state.doc;
    for (let n = 1; n <= d.lines; n++) {
      const line = d.line(n);
      if (!line.text.includes("|") || !line.text.includes(rowMatch)) continue;
      // Split on unescaped pipes, ignoring pipes inside code spans.
      const cells = []; let start = 0, inCode = false;
      const lead = line.text.trimStart().startsWith("|") ? line.text.indexOf("|") + 1 : 0;
      start = lead;
      for (let i = lead; i <= line.text.length; i++) {
        const ch = line.text[i];
        if (ch === "`") inCode = !inCode;
        if (i === line.text.length || (ch === "|" && line.text[i - 1] !== "\\" && !inCode)) { cells.push([start, i]); start = i + 1; }
      }
      const [s, e] = cells[col];
      const raw = line.text.slice(s, e);
      const ls = raw.length - raw.trimStart().length, rs = raw.length - raw.trimEnd().length;
      return edit(doc, { from: line.from + s + ls, to: line.from + e - rs, insert: value });
    }
    throw new Error("row not found: " + rowMatch);
  },
  // Insert a new table row after the row matching `rowMatch`, copying that row's pipe style.
  insertRowAfter(doc, rowMatch, values) {
    const d = doc.state.doc;
    for (let n = 1; n <= d.lines; n++) {
      const line = d.line(n);
      if (!line.text.includes("|") || !line.text.includes(rowMatch)) continue;
      const leading = line.text.trimStart().startsWith("|"), trailing = line.text.trimEnd().endsWith("|");
      const row = (leading ? "| " : "") + values.join(" | ") + (trailing ? " |" : "");
      return edit(doc, { from: line.to, insert: "\n" + row });
    }
    throw new Error("row not found: " + rowMatch);
  },
  replaceText(doc, find, replacement) {
    const i = doc.state.doc.toString().indexOf(find);
    if (i < 0) throw new Error("text not found: " + find);
    return edit(doc, { from: i, to: i + find.length, insert: replacement });
  },
  insertParagraphAfter(doc, find, paragraph) {
    const text = doc.state.doc.toString();
    const i = text.indexOf(find);
    if (i < 0) throw new Error("text not found: " + find);
    const line = doc.state.doc.lineAt(i);
    return edit(doc, { from: line.to, insert: "\n\n" + paragraph });
  },
};
