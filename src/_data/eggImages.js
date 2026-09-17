const fs = require("node:fs");

const EGG_IMAGE_DIR = "src/assets/images/easter-egg";

// The easter egg page picks from whatever photos are sitting in the folder, so
// dropping a new one in is all it takes -- no list to keep in step by hand.
// Eleventy exposes this as the global `eggImages` and keeps _data out of the
// build output.
module.exports = () =>
  fs
    .readdirSync(EGG_IMAGE_DIR)
    .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
    .sort();
