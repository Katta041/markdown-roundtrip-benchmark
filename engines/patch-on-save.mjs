// The reference technique in reference/patch-on-save.mjs: CodeMirror 6 holds the
// text, and saving applies only the recorded changes to the original bytes.
import { openDoc, save } from "../reference/patch-on-save.mjs";

export default {
  id: "patch-on-save",
  name: "CodeMirror 6 + patch-on-save (reference)",
  approach: "Keep the original bytes; on save, apply only the edited ranges to them (reference/patch-on-save.mjs).",
  usedBy: "Reference technique in this repository.",
  packages: ["@codemirror/state"],
  input: "bytes",
  roundTrip: (buf) => save(openDoc(buf)),
};
