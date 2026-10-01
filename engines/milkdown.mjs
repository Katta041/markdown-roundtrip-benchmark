// Milkdown 7: a ProseMirror WYSIWYG editor that parses and serializes with remark.
// Run with the commonmark and gfm presets only (no frontmatter or math plugins).
import { defaultValueCtx, Editor, rootCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { getMarkdown } from "@milkdown/kit/utils";

export default {
  id: "milkdown",
  name: "Milkdown 7 (commonmark + gfm presets)",
  approach: "Load into the WYSIWYG editor (ProseMirror, in jsdom), read back with getMarkdown().",
  usedBy: "Milkdown and its Crepe editor, and apps built on them.",
  packages: ["@milkdown/kit"],
  input: "text",
  slow: true,
  roundTrip: async (md) => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, md);
      })
      .use(commonmark)
      .use(gfm)
      .create();
    try {
      return editor.action(getMarkdown());
    } finally {
      await editor.destroy();
      root.remove();
    }
  },
};
