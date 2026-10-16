import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ScanLine, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { CATEGORIES } from "./Expenses";
import { localISO } from "../utils/dates";
import { parseReceipt } from "../utils/receiptParser";
import { prepareForOCR } from "../utils/receiptImage";
import { AI_URL, scanWithAI } from "../utils/receiptAI";

const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
const MAX_BYTES = 5 * 1024 * 1024;

export default function ScanReceipt() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const cur = profile.currency;
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [f, setF] = useState(null);
  const [readOk, setReadOk] = useState(true);
  const [dateNote, setDateNote] = useState("");
  const [rawText, setRawText] = useState("");
  const [reader, setReader] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (e) => {
    const x = e.target.files[0]; e.target.value = "";
    if (!x) return;
    if (!OK_TYPES.includes(x.type)) return toast.error("Use a JPG, PNG or WebP image.");
    if (x.size > MAX_BYTES) return toast.error("The image is larger than 5 MB. Use a smaller photo.");
    setFile(x); setPreview(URL.createObjectURL(x)); setF(null); setRawText(""); setDateNote(""); setReader("");
  };

  // Puts a result (from AI or OCR) into the editable form. Nothing is saved yet.
  const fillForm = (p, text, who) => {
    const today = new Date();
    let date = p.date, note = "";
    if (!date) { date = localISO(today); note = "No date was found on the receipt, so today's date is filled in. Please check it."; }
    else if ((new Date(date) - today) / 864e5 < -400 || (new Date(date) - today) / 864e5 > 1) {
      note = `The date read from the receipt (${date}) looks wrong, so today's date is filled in. Please check it.`; date = localISO(today);
    }
    setDateNote(note); setRawText(text); setReader(who);
    setReadOk(who === "AI" || text.trim().length >= 15);
    setF({
      merchant: p.merchant || "", date, category: CATEGORIES.includes(p.category) ? p.category : "Other", paymentMethod: "Cash",
      total: p.total != null ? String(p.total) : "", subtotal: p.subtotal != null ? String(p.subtotal) : "",
      discount: p.discount ? String(p.discount) : "", tax: p.tax ? String(p.tax) : "",
      items: (p.items || []).map((i) => ({ name: i.name, qty: String(i.qty), amount: String(i.amount) })),
    });
  };

  const runOCR = async () => {
    let worker;
    try {
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("eng", 1, { logger: (m) => { if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100)); } });
      await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
      let text = (await worker.recognize(await prepareForOCR(file, 8))).data.text || "";
      let p = parseReceipt(text);
      if (p.total == null) {
        await worker.setParameters({ tessedit_pageseg_mode: "4" });
        const t2 = (await worker.recognize(await prepareForOCR(file, 14))).data.text || "";
        const p2 = parseReceipt(t2);
        if (p2.total != null) { text = t2; p = p2; }
      }
      return { p, text };
    } finally { if (worker) await worker.terminate(); }
  };

  const scan = async () => {
    setBusy(true); setProgress(0);
    try {
      if (AI_URL) {
        try {
          const r = await scanWithAI(file);
          if (!r.isReceipt) { toast.error("The AI did not find a receipt in this photo. Try another photo or fill it in manually."); setBusy(false); return; }
          fillForm(r, JSON.stringify(r, null, 2), "AI"); setBusy(false); return;
        } catch (e) {
          console.error(e);
          toast(e.status === 429 ? "The free AI limit was reached. Using the offline reader instead." : e.status === 401 ? "Please log out and log in again to use the AI reader. Using the offline reader." : "The AI reader is unavailable. Using the offline reader instead.");
        }
      }
      const { p, text } = await runOCR();
      fillForm(p, text, "OCR");
    } catch (e) { console.error(e); toast.error("Could not read the receipt. Check your internet connection and try again."); }
    setBusy(false);
  };

  const manual = () => { setReadOk(true); setDateNote(""); setF({ merchant: "", date: localISO(new Date()), category: "Other", paymentMethod: "Cash", total: "", subtotal: "", discount: "", tax: "", items: [] }); };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setItem = (i, k, v) => setF({ ...f, items: f.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) });

  const confirm = async (e) => {
    e.preventDefault();
    const total = Number(f.total);
    if (!f.merchant.trim()) return toast.error("Merchant is required.");
    if (!f.date) return toast.error("Choose the receipt date.");
    if (!(total > 0)) return toast.error("The total must be greater than 0.");
    const items = f.items.filter((i) => i.name.trim() && Number(i.amount) > 0).slice(0, 50)
      .map((i) => ({ name: i.name.trim(), qty: Math.max(1, Number(i.qty) || 1), amount: Number(i.amount) }));
    const names = items.map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name)).join(", ");
    const description = items.length ? `Receipt scan: ${names.slice(0, 430)} (${items.length} items)` : "Receipt scan";
    setSaving(true);
    try {
      await addDoc(collection(db, "expenses"), {
        userId: user.uid, merchant: f.merchant.trim(), amount: total, date: f.date, category: f.category,
        description, paymentMethod: f.paymentMethod, source: "receipt-scan",
        receipt: { items, subtotal: Number(f.subtotal) || 0, discount: Number(f.discount) || 0, tax: Number(f.tax) || 0 },
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      toast.success("Receipt saved as an expense"); nav("/expenses");
    } catch (x) { console.error(x); toast.error("Could not save the expense."); setSaving(false); }
  };

  const itemsSum = f ? f.items.reduce((t, i) => t + (Number(i.amount) || 0), 0) : 0;
  const showMismatch = f && f.items.length > 0 && Number(f.total) > 0 && Math.abs(itemsSum - Number(f.total)) > 0.5;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Scan a receipt</h1>
      <p className="text-sm text-slate-400">{AI_URL ? "The AI reader sends a shrunken copy of the photo to Google Gemini through your own secure Worker. If it is unavailable, the photo is read on your device instead." : "The photo is read on your own device and is not uploaded."} Nothing is saved until you confirm.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass space-y-4 p-5">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-white/20 p-6 text-center text-sm text-slate-300 hover:bg-white/5">
            <ScanLine className="text-mint" /> Choose a receipt photo
            <span className="text-xs text-slate-500">JPG, PNG or WebP, up to 5 MB. Lay the receipt flat, in good light, filling the photo.</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/bmp" hidden onChange={pick} />
          </label>
          {preview && <img src={preview} alt="Selected receipt" className="max-h-[28rem] w-full rounded-xl object-contain" />}
          {file && !f && <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={scan} disabled={busy}>{busy ? `Reading… ${progress}%` : "Read receipt"}</button>
            <button className="btn-ghost" onClick={manual} disabled={busy}>Fill in manually</button></div>}
          {busy && <p className="text-xs text-slate-400">The first scan downloads the reading engine (a few MB), so it can take up to a minute.</p>}
        </div>

        {f && (
          <form onSubmit={confirm} className="glass space-y-3 p-5">
            <h2 className="font-bold">Check the details</h2>
            {reader && <p className="text-xs text-slate-400">{reader === "AI" ? "Read by the AI reader (Gemini). AI can still make mistakes, so check every field." : "Read by the offline OCR reader. Check every field."}</p>}
            {!readOk && <p className="rounded-xl border border-amber-400/40 p-3 text-sm text-amber-300">Very little text was found. Use a flat, well-lit, sharp photo, or fill the fields in yourself.</p>}
            {dateNote && <p className="rounded-xl border border-amber-400/40 p-3 text-sm text-amber-300">{dateNote}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">Merchant</label><input className="input" value={f.merchant} onChange={set("merchant")} /></div>
              <div><label className="label">Date</label><input className="input" type="date" value={f.date} onChange={set("date")} /></div>
              <div><label className="label">Category (suggested)</label><select className="input" value={f.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label className="label">Payment method</label><select className="input" value={f.paymentMethod} onChange={set("paymentMethod")}>{["Cash", "Card", "Bank transfer", "Mobile wallet"].map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label className="label">Total ({cur})</label><input className="input" type="number" step="0.01" min="0" value={f.total} onChange={set("total")} /></div>
              <div><label className="label">Subtotal</label><input className="input" type="number" step="0.01" min="0" value={f.subtotal} onChange={set("subtotal")} /></div>
              <div><label className="label">Discount</label><input className="input" type="number" step="0.01" min="0" value={f.discount} onChange={set("discount")} /></div>
              <div><label className="label">Tax</label><input className="input" type="number" step="0.01" min="0" value={f.tax} onChange={set("tax")} /></div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between"><label className="label !mb-0">Items</label>
                <button type="button" className="btn-ghost !px-3 !py-1.5" onClick={() => setF({ ...f, items: [...f.items, { name: "", qty: "1", amount: "" }] })}><Plus size={14} />Add item</button></div>
              {f.items.length === 0 && <p className="text-xs text-slate-500">No items were found. You can add them or leave this empty.</p>}
              <div className="space-y-2">{f.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input className="input col-span-6" placeholder="Item" value={it.name} onChange={(e) => setItem(i, "name", e.target.value)} />
                  <input className="input col-span-2" type="number" min="1" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, "qty", e.target.value)} />
                  <input className="input col-span-3" type="number" step="0.01" min="0" placeholder="Amount" value={it.amount} onChange={(e) => setItem(i, "amount", e.target.value)} />
                  <button type="button" aria-label="Remove item" className="col-span-1 text-slate-400 hover:text-red-400" onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== i) })}><Trash2 size={16} /></button>
                </div>))}</div>
              {showMismatch && <p className="mt-2 text-xs text-amber-300">The items add up to {cur} {itemsSum.toLocaleString()} but the total is {cur} {Number(f.total).toLocaleString()}. That can be normal with tax or discounts, otherwise check the numbers.</p>}
            </div>

            {rawText && <details className="text-xs text-slate-400"><summary className="cursor-pointer">Show what was read</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-white/5 p-3">{rawText}</pre></details>}

            <div className="flex gap-2"><button className="btn" disabled={saving}>{saving ? "Saving…" : "Confirm and save"}</button>
              <button type="button" className="btn-ghost" onClick={() => setF(null)}>Discard</button></div>
          </form>
        )}
      </div>
    </div>
  );
}
