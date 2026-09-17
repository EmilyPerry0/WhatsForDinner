// Recipe pages hold the screen on while they're open: you cook with your hands
// full, the phone sits on the counter, and the screen locks before you can look
// back at the next step.

// The lock we currently hold, if any.
let sentinel = null;
// A request that hasn't resolved yet, so two events can't race two requests.
let pending = false;

async function acquire() {
  // Absent both in browsers that don't implement it and over plain HTTP, since
  // the API is secure-context only. One check covers both.
  if (!("wakeLock" in navigator)) return;
  if (sentinel && !sentinel.released) return;
  if (pending) return;

  pending = true;
  try {
    sentinel = await navigator.wakeLock.request("screen");
  } catch {
    // The browser is entitled to refuse: page not visible, battery saver, an OS
    // that won't allow it. There is nothing to do about it and nothing worth
    // interrupting a cook with, so the screen just dims as it normally would.
    sentinel = null;
  } finally {
    pending = false;
  }
}

export function keepAwake() {
  acquire();

  // The browser drops the lock every time the page is hidden — switching apps,
  // locking the phone, another tab taking focus — and never restores it on its
  // own. Without this the screen stays awake exactly once and then quietly
  // stops, which looks like the feature was never there.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") acquire();
  });
}
