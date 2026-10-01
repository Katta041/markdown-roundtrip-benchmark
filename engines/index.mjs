// The engines, in the order they appear in every table. To add one, create a
// module with the same shape (see CONTRIBUTING.md) and add it here.
import codemirrorNaive from "./codemirror-naive.mjs";
import milkdown from "./milkdown.mjs";
import patchOnSave from "./patch-on-save.mjs";
import prosemirrorMarkdown from "./prosemirror-markdown.mjs";
import remark from "./remark.mjs";
import tiptap from "./tiptap.mjs";
import turndown from "./turndown.mjs";

export const ENGINES = [remark, prosemirrorMarkdown, turndown, milkdown, tiptap, codemirrorNaive, patchOnSave];
