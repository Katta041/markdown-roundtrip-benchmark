// Tiptap 3 with the official @tiptap/markdown extension, StarterKit, tables and task lists.
import { Editor } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";

export default {
  id: "tiptap",
  name: "Tiptap 3 + @tiptap/markdown",
  approach: "Load markdown into the editor (ProseMirror, in jsdom), read back with editor.getMarkdown().",
  usedBy: "Tiptap-based editors in many web apps.",
  packages: ["@tiptap/core", "@tiptap/markdown", "@tiptap/starter-kit", "@tiptap/extension-table", "@tiptap/extension-list"],
  input: "text",
  slow: true,
  roundTrip: (md) => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const editor = new Editor({
      element: el,
      extensions: [StarterKit, Markdown, TableKit, TaskList, TaskItem.configure({ nested: true })],
      content: md,
      contentType: "markdown",
    });
    try {
      return editor.getMarkdown();
    } finally {
      editor.destroy();
      el.remove();
    }
  },
};
