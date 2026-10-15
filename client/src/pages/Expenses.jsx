import { useEffect, useState, useCallback } from "react";
import { collection, query, where, orderBy, limit, startAfter, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { Trash2, Pencil, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

export const CATEGORIES = ["Food", "Groceries", "Transport", "Shopping", "Bills", "Education", "Entertainment", "Health", "Other"];
const PAGE = 15;
const empty = { date: new Date().toISOString().slice(0, 10), merchant: "", amount: "", category: "Food", description: "", paymentMethod: "Cash" };

export default function Expenses() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState([]); const [last, setLast] = useState(null); const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true); const [cat, setCat] = useState("All"); const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);

  const load = useCallback(async (reset = true) => {
    setLoading(true);
    const c = [where("userId", "==", user.uid)];
    if (cat !== "All") c.push(where("category", "==", cat));
    c.push(orderBy("date", "desc"), limit(PAGE));
    if (!reset && last) c.push(startAfter(last));
    try {
      const snap = await getDocs(query(collection(db, "expenses"), ...c));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRows(prev => reset ? data : [...prev, ...data]); setLast(snap.docs[snap.docs.length - 1]); setMore(snap.size === PAGE);
    } catch (e) { toast.error(e.code === "failed-precondition" ? "Missing index: open the link in the browser console to create it." : "Could not load expenses."); console.error(e); }
    setLoading(false);
  }, [user.uid, cat, last]);
  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [cat]);

  const save = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!(amount > 0)) return toast.error("Amount must be greater than 0.");
    if (!form.merchant.trim()) return toast.error("Merchant is required.");
    const data = { date: form.date, merchant: form.merchant.trim(), amount, category: form.category, description: form.description.trim(), paymentMethod: form.paymentMethod, userId: user.uid, updatedAt: serverTimestamp() };
    try {
      if (form.id) await updateDoc(doc(db, "expenses", form.id), data);
      else await addDoc(collection(db, "expenses"), { ...data, createdAt: serverTimestamp() });
      toast.success(form.id ? "Expense updated" : "Expense added"); setForm(null); load(true);
    } catch { toast.error("Could not save expense."); }
  };
  const remove = async (r) => {
    if (!window.confirm(`Delete expense at ${r.merchant}?`)) return;
    await deleteDoc(doc(db, "expenses", r.id)); toast.success("Expense deleted"); setRows(rows.filter(x => x.id !== r.id));
  };
  const shown = rows.filter(r => (r.merchant + r.description).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-extrabold">Expenses</h1>
        <button className="btn" onClick={() => setForm(empty)}><Plus size={16} />Add expense</button></div>
      <div className="glass flex flex-wrap gap-3 p-3">
        <input className="input max-w-xs" placeholder="Search merchant or note" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input max-w-[11rem]" value={cat} onChange={e => setCat(e.target.value)}>{["All", ...CATEGORIES].map(c => <option key={c}>{c}</option>)}</select>
      </div>
      {form && (
        <form onSubmit={save} className="glass grid gap-3 p-5 md:grid-cols-3">
          <div><label className="label">Date</label><input className="input" type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div><label className="label">Merchant</label><input className="input" required value={form.merchant} onChange={e => setForm({ ...form, merchant: e.target.value })} /></div>
          <div><label className="label">Amount ({profile?.currency})</label><input className="input" type="number" step="0.01" min="0" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
          <div><label className="label">Category</label><select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label">Payment method</label><select className="input" value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>{["Cash", "Card", "Bank transfer", "Mobile wallet"].map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label">Description</label><input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex gap-2 md:col-span-3"><button className="btn">Save</button><button type="button" className="btn-ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>)}
      <div className="glass overflow-x-auto">
        <table className="w-full text-sm"><thead className="text-left text-slate-400"><tr>{["Date", "Merchant", "Category", "Amount", ""].map(h => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{shown.map(r => (
            <tr key={r.id} className="border-t border-white/5"><td className="p-3">{r.date}</td><td className="p-3">{r.merchant}<div className="text-xs text-slate-500">{r.description}</div></td>
              <td className="p-3">{r.category}</td><td className="p-3 font-bold">{profile?.currency} {r.amount.toLocaleString()}</td>
              <td className="p-3 text-right"><button aria-label="Edit" className="p-2 hover:text-mint" onClick={() => setForm({ ...r, amount: String(r.amount) })}><Pencil size={15} /></button>
                <button aria-label="Delete" className="p-2 hover:text-red-400" onClick={() => remove(r)}><Trash2 size={15} /></button></td></tr>))}</tbody></table>
        {loading && <p className="p-6 text-center text-slate-400">Loading…</p>}
        {!loading && shown.length === 0 && <p className="p-8 text-center text-slate-400">No expenses yet. Add your first one to get started.</p>}
      </div>
      {more && !loading && <button className="btn-ghost mx-auto" onClick={() => load(false)}>Load more</button>}
    </div>
  );
}
