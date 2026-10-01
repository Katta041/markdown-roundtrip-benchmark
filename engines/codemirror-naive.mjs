// CodeMirror 6 with default settings, saved with doc.toString().
import { EditorState } from "@codemirror/state";

export default {
  id: "codemirror-naive",
  name: "CodeMirror 6, naive save (doc.toString)",
  approach: "Load the text into a CodeMirror 6 state with default settings and save state.doc.toString().",
  usedBy: "Source editors built on CodeMirror 6. Real apps may configure line separators; this is the default behaviour.",
  packages: ["@codemirror/state"],
  input: "text",
  roundTrip: (md) => EditorState.create({ doc: md }).doc.toString(),
};
