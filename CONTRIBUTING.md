# Contributing

Pull requests that add an engine, fix an adapter, or add a corpus case are welcome. The most useful contribution is an engine we have not tested, or a better configuration of one we have (for example Milkdown or Tiptap with the plugins a real product ships).

## Setup

Node 24 or later.

```bash
npm ci
npm run bench -- --quick   # a few seconds
npm run bench              # full run, a few minutes (Milkdown and Tiptap on 1 MB are slow)
```

## Adding an engine

1. Add the package to `dependencies` in `package.json` with an **exact** version (no `^` or `~`), then run `npm install` so `package-lock.json` is updated.
2. Create `engines/<id>.mjs` that default-exports an adapter:

```js
export default {
  id: "my-engine",            // short, unique, used for results/output/<id>/
  name: "My Engine 2 (preset)", // shown in the tables; include the version family and config
  approach: "How it loads and saves, in one sentence.",
  usedBy: "Which kinds of products use this approach. Facts only, with a link in the PR.",
  packages: ["my-engine"],     // npm packages whose installed versions are recorded in results
  input: "text",               // "text": receives a string; "bytes": receives the original Buffer
  slow: false,                 // optional; true if it needs a DOM or takes seconds on 1 MB
  roundTrip: async (input) => {
    // Load the document exactly as the product would, make NO edits, and return
    // what it would save: a string (written as UTF-8) or a Buffer.
  },
};
```

3. Add it to the `ENGINES` array in `engines/index.mjs`. The order there is the column order in every table.
4. If it needs a DOM, it can rely on the jsdom globals from `engines/dom.mjs`, which `bench.mjs` installs before loading any engine.
5. Run `npm run bench`, check `results/output/<id>/` by eye, and commit the updated `results/`.

Rules for a fair adapter:

- Use the engine's documented, default way to load markdown and get markdown back. If a product ships extra plugins, add a second adapter with those plugins and say so in `name`, rather than changing the default one.
- Do not post-process the output (no trimming, no line-ending fixes). The point is what the engine writes.
- An adapter must not throw for the corpus files if the engine itself does not. If it does throw, the error is recorded in the results, which is a finding too.

## Adding a corpus case

Add a source file to `corpus/src/` (LF, simulated content only, never real client or personal data), add an entry to `VARIANTS` in `corpus/build.mjs`, then run `npm run corpus` to rebuild the byte variants and `corpus/SHA256SUMS`. Never open and save corpus files in an editor; the byte-level details are the point.

## Style

No em-dashes and no emoji in code, comments or docs. Errors a user can cause must be one clear line and a non-zero exit, not a stack trace.
