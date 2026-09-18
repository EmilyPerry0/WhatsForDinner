import test from "node:test";
import assert from "node:assert/strict";

const MODULE = new URL(
  "../src/assets/js/keep-awake.mjs",
  import.meta.url,
).toString();

// The module holds its own state, so each case needs a fresh copy.
let loads = 0;
const freshModule = () => import(`${MODULE}?case=${++loads}`);

// Node defines navigator itself, read-only, so it has to be defined over.
function setNavigator(value) {
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true,
    writable: true,
  });
}

// Minimal stand-in for the parts of document the module touches, plus handles to
// drive a hide/show cycle the way a browser would.
function stubDocument() {
  const listeners = [];
  globalThis.document = {
    visibilityState: "visible",
    addEventListener: (type, fn) => {
      if (type === "visibilitychange") listeners.push(fn);
    },
  };
  return {
    listenerCount: () => listeners.length,
    hide() {
      globalThis.document.visibilityState = "hidden";
      listeners.forEach((fn) => fn());
    },
    show() {
      globalThis.document.visibilityState = "visible";
      listeners.forEach((fn) => fn());
    },
  };
}

// A wake lock that records how often it was asked for.
function stubWakeLock() {
  const calls = [];
  let current = null;
  setNavigator({
    wakeLock: {
      request: async (type) => {
        calls.push(type);
        current = { released: false };
        return current;
      },
    },
  });
  return { calls, release: () => (current.released = true) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test("asks for a screen lock when the page loads", async () => {
  stubDocument();
  const lock = stubWakeLock();

  const { keepAwake } = await freshModule();
  keepAwake();
  await settle();

  assert.deepEqual(lock.calls, ["screen"]);
});

test("does not ask again while it still holds the lock", async () => {
  const doc = stubDocument();
  const lock = stubWakeLock();

  const { keepAwake } = await freshModule();
  keepAwake();
  await settle();

  // A visibility event while still visible and still holding shouldn't pile up
  // duplicate requests.
  doc.show();
  await settle();

  assert.equal(lock.calls.length, 1);
});

test("re-acquires after the page is hidden and shown again", async () => {
  // The heart of it: browsers drop the lock every time the page hides and never
  // restore it. Without this the screen stays awake exactly once and then
  // quietly stops, which looks like the feature was never wired up.
  const doc = stubDocument();
  const lock = stubWakeLock();

  const { keepAwake } = await freshModule();
  keepAwake();
  await settle();

  doc.hide();
  lock.release(); // what the browser does on its own
  await settle();
  assert.equal(lock.calls.length, 1, "nothing requested while hidden");

  doc.show();
  await settle();
  assert.deepEqual(lock.calls, ["screen", "screen"]);
});

test("registers a single visibility listener", async () => {
  // One per page load; a leak here would multiply requests on every change.
  const doc = stubDocument();
  stubWakeLock();

  const { keepAwake } = await freshModule();
  keepAwake();
  await settle();

  assert.equal(doc.listenerCount(), 1);
});

test("does nothing when the browser has no wake lock", async () => {
  // Older browsers, and any page served over plain HTTP -- the API is
  // secure-context only, so the property is simply absent.
  stubDocument();
  setNavigator({});

  const { keepAwake } = await freshModule();
  await assert.doesNotReject(async () => {
    keepAwake();
    await settle();
  });
});

test("survives the browser refusing the request", async () => {
  // Battery saver, or an OS that declines. The screen just dims as normal.
  const doc = stubDocument();
  setNavigator({
    wakeLock: {
      request: async () => {
        throw new Error("NotAllowedError");
      },
    },
  });

  const { keepAwake } = await freshModule();
  await assert.doesNotReject(async () => {
    keepAwake();
    await settle();
    doc.show();
    await settle();
  });
});
