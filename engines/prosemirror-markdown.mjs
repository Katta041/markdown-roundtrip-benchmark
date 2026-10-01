// prosemirror-markdown: the ProseMirror project's markdown parser and serializer.
import { defaultMarkdownParser, defaultMarkdownSerializer } from "prosemirror-markdown";

export default {
  id: "prosemirror-markdown",
  name: "prosemirror-markdown",
  approach: "Parse into a ProseMirror document (markdown-it), serialize with the default serializer.",
  usedBy: "The markdown module of ProseMirror, the base of many rich-text editors.",
  packages: ["prosemirror-markdown"],
  input: "text",
  roundTrip: (md) => defaultMarkdownSerializer.serialize(defaultMarkdownParser.parse(md)),
};
