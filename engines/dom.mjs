// Installs a jsdom window as globals so DOM-based editors (Milkdown, Tiptap) can
// run in Node. bench.mjs imports this first, before any engine, so every engine
// runs in the same environment on every run.
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const KEYS = [
  "window", "document", "navigator", "Node", "HTMLElement", "Element", "DocumentFragment", "MutationObserver",
  "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "DOMParser", "Text", "Range", "Selection",
  "ClipboardEvent", "DragEvent", "KeyboardEvent", "InputEvent",
];
for (const k of KEYS) {
  if (!(k in globalThis) || globalThis[k] === undefined) {
    try {
      globalThis[k] = dom.window[k];
    } catch {
      Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true });
    }
  }
}
dom.window.document.createRange ??= () => new dom.window.Range();
for (const k of ["addEventListener", "removeEventListener", "dispatchEvent"]) globalThis[k] = dom.window[k].bind(dom.window);
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.Event = dom.window.Event;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
dom.window.Element.prototype.getClientRects ??= () => [];
dom.window.Range.prototype.getClientRects = () => [];
dom.window.Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
