// Choosing the next easter-egg photo. Kept free of the DOM so the unit tests can
// import it directly.

// A plain random pick would land on the photo already showing about one time in
// eight, and a button that sometimes does nothing visible reads as broken. So
// the choice is made from the *other* photos.
//
// `random` is injectable so the tests can drive it deterministically.
export function pickDifferent(photos, current, random = Math.random) {
  if (!Array.isArray(photos) || photos.length === 0) return undefined;

  const others = photos.filter((photo) => photo !== current);
  // Empty when nothing is showing yet, or when there is only the one photo —
  // in both cases anything in the set is a fine answer.
  const pool = others.length > 0 ? others : photos;

  // Math.random() never returns 1, but an injected one might, and an index off
  // the end would hand back undefined.
  const index = Math.min(Math.floor(random() * pool.length), pool.length - 1);
  return pool[index];
}
