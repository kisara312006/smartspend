import { auth } from "../firebase/config";

// Address of your Cloudflare Worker (set in client/.env). Empty means: use the offline reader only.
export const AI_URL = import.meta.env.VITE_RECEIPT_AI_URL || "";

// Shrinks the photo before sending: faster, cheaper and it never leaves your device at full size.
async function shrink(file, maxSide = 1400) {
  const url = URL.createObjectURL(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Could not open the image")); i.src = url; });
  URL.revokeObjectURL(url);
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

export async function scanWithAI(file) {
  if (!AI_URL) throw Object.assign(new Error("AI reader is not set up"), { status: 0 });
  const image = await shrink(file);
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ image, mimeType: "image/jpeg" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "AI request failed"), { status: res.status });
  return data;
}
