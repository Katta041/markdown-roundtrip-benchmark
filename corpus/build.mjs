// Builds the benchmark corpus from corpus/src into corpus/, applying byte-level
// variants (CRLF with a UTF-8 BOM, mixed line endings, no final newline), and
// writes corpus/SHA256SUMS. Also exports the generator for the large stress
// files used by the performance section (generated in memory, never committed).
//
// Usage: npm run corpus    (the same as: node corpus/build.mjs)
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CORPUS_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(CORPUS_DIR, "src");
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/** Reads a source file as UTF-8 text with LF line endings, exactly as committed. */
function src(name) {
  const file = path.join(SRC_DIR, name);
  if (!fs.existsSync(file)) throw new Error(`corpus source missing: corpus/src/${name}`);
  const text = fs.readFileSync(file, "utf8");
  if (text.includes("\r")) {
    throw new Error(`corpus/src/${name} contains CR characters; git probably converted line endings on checkout. Re-clone with core.autocrlf=false.`);
  }
  return text;
}

/** The six corpus files: name, what it simulates, and how its bytes are produced. */
export const VARIANTS = [
  { file: "01-pentest-findings.md", bytes: "LF", build: () => Buffer.from(src("01-pentest-findings.md")) },
  {
    file: "02-ai-code-audit.md",
    bytes: "CRLF + UTF-8 BOM",
    build: () => Buffer.concat([BOM, Buffer.from(src("02-ai-code-audit.md").replace(/\n/g, "\r\n"))]),
  },
  {
    file: "03-soc2-audit.md",
    bytes: "mixed CRLF/LF",
    build: () =>
      Buffer.from(
        src("03-soc2-audit.md")
          .split("\n")
          .map((l, i, a) => (i === a.length - 1 ? l : l + (i % 3 === 0 ? "\r\n" : "\n")))
          .join(""),
      ),
  },
  { file: "04-architecture-spec.md", bytes: "LF", build: () => Buffer.from(src("04-architecture-spec.md")) },
  { file: "05-llm-chat-export.md", bytes: "LF", build: () => Buffer.from(src("05-llm-chat-export.md")) },
  { file: "06-edge-cases.md", bytes: "LF, no final newline", build: () => Buffer.from(src("06-edge-cases.md").replace(/\n+$/, "")) },
];

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** Generates a large LF report of at least `mb` MiB by repeating findings and audits with unique IDs. */
export function stress(mb) {
  const block = src("01-pentest-findings.md").split("## Findings")[1].split("## Appendix A")[0];
  const audit = src("02-ai-code-audit.md");
  const parts = [`# Stress report ${mb} MB\n\nGenerated corpus for performance testing.\n`];
  let size = 0;
  for (let i = 0; size < mb * 1024 * 1024; i++) {
    const chunk = `\n## Batch ${i}\n` + block.replace(/F-0(\d)/g, `F-${i}-$1`) + (i % 3 === 0 ? audit.replace(/^# .*$/m, `## Audit ${i}`) : "");
    parts.push(chunk);
    size += Buffer.byteLength(chunk);
  }
  return Buffer.from(parts.join(""));
}

function main() {
  const sums = [];
  for (const v of VARIANTS) {
    const buf = v.build();
    fs.writeFileSync(path.join(CORPUS_DIR, v.file), buf);
    sums.push(`${sha256(buf)}  ${v.file}`);
    console.log(`${v.file.padEnd(26)} ${String(buf.length).padStart(6)} bytes  ${v.bytes}`);
  }
  fs.writeFileSync(path.join(CORPUS_DIR, "SHA256SUMS"), sums.join("\n") + "\n");
  console.log("Wrote corpus/SHA256SUMS");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error(`corpus: ${e.message}`);
    process.exit(1);
  }
}
