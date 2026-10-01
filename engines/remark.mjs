// remark (unified): parse to an mdast tree and serialize it back with remark-stringify.
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ["yaml", "toml"]).use(remarkMath).use(remarkStringify);

export default {
  id: "remark",
  name: "remark (unified + gfm, frontmatter, math)",
  approach: "Parse to a syntax tree (mdast), serialize with remark-stringify.",
  usedBy: "MDX and many docs and CMS toolchains; Milkdown parses and serializes through remark.",
  packages: ["unified", "remark-parse", "remark-stringify", "remark-gfm", "remark-frontmatter", "remark-math"],
  input: "text",
  roundTrip: (md) => String(processor.processSync(md)),
};
