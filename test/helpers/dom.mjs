import { JSDOM } from "jsdom";

// Globals the browser modules reach for. Several of these (navigator above all)
// are defined read-only by Node itself, so they have to be defined over rather
// than assigned.
const GLOBALS = [
  "window",
  "document",
  "location",
  "navigator",
  "localStorage",
  "Image",
  "Event",
  "CustomEvent",
  "HTMLElement",
  "getComputedStyle",
];

function define(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}

// Stand up a page and expose it as the global environment, so an ES module that
// touches the DOM at import time has something to touch.
export function installDom(html, { url = "https://example.com/" } = {}) {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true });
  for (const name of GLOBALS) {
    const value = dom.window[name];
    define(name, typeof value === "function" ? value.bind(dom.window) : value);
  }
  // Re-expose the constructors unbound; binding them would break `new`.
  define("Image", dom.window.Image);
  define("Event", dom.window.Event);
  define("CustomEvent", dom.window.CustomEvent);
  define("HTMLElement", dom.window.HTMLElement);
  return dom;
}

// localStorage that throws on every call, as it does in private mode.
export function breakLocalStorage() {
  const boom = () => {
    throw new Error("SecurityError");
  };
  define("localStorage", {
    getItem: boom,
    setItem: boom,
    removeItem: boom,
    clear: boom,
  });
}

// Browser modules keep state at module scope, so each case needs its own copy.
// The path is relative to the project root, not to whichever test is calling.
let loads = 0;
export function freshImport(pathFromRoot) {
  const url = new URL(`../../${pathFromRoot}`, import.meta.url).toString();
  return import(`${url}?case=${++loads}`);
}
