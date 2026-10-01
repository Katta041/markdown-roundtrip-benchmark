// HTML round trip: render markdown to HTML with marked, convert back with turndown.
import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

export default {
  id: "turndown",
  name: "marked -> HTML -> turndown",
  approach: "Render to HTML (marked, GFM), convert the HTML back to markdown (turndown + GFM plugin).",
  usedBy: "Editors that keep HTML as the document and convert back to markdown on save or paste.",
  packages: ["marked", "turndown", "turndown-plugin-gfm"],
  input: "text",
  roundTrip: (md) => {
    const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
    td.use(gfm);
    return td.turndown(marked.parse(md, { gfm: true }));
  },
};
