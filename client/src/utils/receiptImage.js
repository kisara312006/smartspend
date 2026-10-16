// Turns a phone photo into a high-contrast black-and-white image that OCR can read.
// It uses the red channel: dark ink of any colour (black, blue, purple) stays dark,
// while white or yellow paper stays bright. Then it makes each area sharp against its surroundings.
export async function prepareForOCR(file, C = 8) {
  const url = URL.createObjectURL(file);
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Could not open the image"));
    i.src = url;
  });
  URL.revokeObjectURL(url);

  const s = 2560 / Math.max(img.naturalWidth, img.naturalHeight);
  const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data, n = w * h;

  const g = new Float32Array(n), hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) { const v = px[i * 4]; g[i] = v; hist[v]++; }
  const pct = (p) => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * p) return v; } return 255; };
  const lo = pct(0.02), hi = Math.max(pct(0.98), lo + 1);
  for (let i = 0; i < n; i++) g[i] = Math.min(255, Math.max(0, ((g[i] - lo) / (hi - lo)) * 255));

  // Integral image: lets us get the average brightness around every pixel quickly
  const W = w + 1, integ = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) { row += g[y * w + x]; integ[(y + 1) * W + x + 1] = integ[y * W + x + 1] + row; }
  }
  let win = Math.round(Math.max(w, h) / 62); win |= 1;
  const r = (win - 1) / 2;
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      const sum = integ[(y1 + 1) * W + x1 + 1] - integ[y0 * W + x1 + 1] - integ[(y1 + 1) * W + x0] + integ[y0 * W + x0];
      const mean = sum / ((x1 - x0 + 1) * (y1 - y0 + 1));
      const v = g[y * w + x] < mean - C ? 0 : 255;
      const o = (y * w + x) * 4;
      px[o] = px[o + 1] = px[o + 2] = v; px[o + 3] = 255;
    }
  }
  ctx.putImageData(data, 0, 0);
  return new Promise((res) => canvas.toBlob(res, "image/png"));
}
