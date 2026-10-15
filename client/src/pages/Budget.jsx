import { useEffect, useState, useCallback } from "react";
import { collection, query, where, orderBy, getDocs, setDoc, deleteDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { CATEGORIES } from "./Expenses";
import { monthKey, monthBounds } from "../utils/dates";

// Status is shown as words as well as colour, so it is readable without relying on colour.
function status(pct) {
  if (pct >= 100) return { label: "Over budget", bar: "bg-red-400", text: "text-red-300" };
  if (pct >= 80) return { label: "Close to the limit", bar: "bg-amber-400", text: "text-amber-300" };
  return { label: "On track", bar: "bg-mint", text: "text-mint" };
}

export default function Budget() {
  const { user, profile, refreshProfile } = useAuth();
  const cur = profile.currency;
  const { start, end } = monthBounds(monthKey(new Date()));
  const [budgets, setBudgets] = useState(null);
  const [spent, setSpent] = useState({});
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState(false);
  const [overall, setOverall] = useState(profile.monthlyBudget || 0);
  const [cat, setCat] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState("");

  const load = useCallback(async () => {
    try {
      const [b, e] = await Promise.all([
        getDocs(query(collection(db, "budgets"), where("userId", "==", user.uid))),
        getDocs(query(collection(db, "expenses"), where("userId", "==", user.uid), where("date", ">=", start), where("date", "<=", end), orderBy("date", "desc"))),
      ]);
      const by = {}; let t = 0;
      e.docs.forEach((d) => { const r = d.data(); by[r.category] = (by[r.category] || 0) + r.amount; t += r.amount; });
      setSpent(by); setTotal(t);
      setBudgets(b.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => x.category.localeCompare(y.category)));
    } catch (x) { console.error(x); setErr(true); }
  }, [user.uid, start, end]);
  useEffect(() => { load(); }, [load]);

  const saveOverall = async (e) => {
    e.preventDefault();
    if (!(Number(overall) >= 0)) return toast.error("Budget cannot be negative.");
    try {
      await updateDoc(doc(db, "users", user.uid), { monthlyBudget: Number(overall), updatedAt: serverTimestamp() });
      await refreshProfile(); toast.success("Monthly budget saved");
    } catch { toast.error("Could not save the budget."); }
  };

  const saveCategory = async (e) => {
    e.preventDefault();
    const n = Number(amount);
    if (!(n > 0)) return toast.error("Enter an amount greater than 0.");
    try {
      // One document per user and category, so saving again updates the same budget.
      await setDoc(doc(db, "budgets", `${user.uid}_${cat}`), { userId: user.uid, category: cat, amount: n, updatedAt: serverTimestamp() });
      toast.success(`${cat} budget saved`); setAmount(""); load();
    } catch { toast.error("Could not save the budget."); }
  };

  const remove = async (b) => {
    if (!window.confirm(`Delete the ${b.category} budget?`)) return;
    await deleteDoc(doc(db, "budgets", b.id)); toast.success("Budget deleted"); load();
  };

  if (err) return <div className="glass p-6">Could not load budgets. If the browser console mentions an index, open the link in it to create the index.</div>;
  if (!budgets) return <div className="glass h-64 animate-pulse" />;

  const money = (n) => `${cur} ${Math.round(n).toLocaleString()}`;
  const overallBudget = profile.monthlyBudget || 0;
  const op = overallBudget ? Math.round((total / overallBudget) * 100) : 0;
  const os = status(op);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Budgets</h1>
      <p className="text-sm text-slate-400">Progress is calculated from your expenses this month.</p>

      <div className="glass space-y-4 p-5">
        <form onSubmit={saveOverall} className="flex flex-wrap items-end gap-3">
          <div><label className="label">Total monthly budget ({cur})</label><input className="input" type="number" min="0" value={overall} onChange={(e) => setOverall(e.target.value)} /></div>
          <button className="btn">Save</button>
        </form>
        {overallBudget > 0 ? (<div>
          <div className="mb-1 flex flex-wrap justify-between text-sm"><span>{money(total)} of {money(overallBudget)} ({op}%)</span><span className={os.text}>{os.label}</span></div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${os.bar}`} style={{ width: `${Math.min(100, op)}%` }} /></div>
          <div className="mt-1 text-xs text-slate-400">{total > overallBudget ? `${money(total - overallBudget)} over` : `${money(overallBudget - total)} remaining`}</div>
        </div>) : <p className="text-sm text-slate-400">Set a total monthly budget to see your progress.</p>}
      </div>

      <form onSubmit={saveCategory} className="glass flex flex-wrap items-end gap-3 p-5">
        <div><label className="label">Category</label><select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className="label">Monthly limit ({cur})</label><input className="input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <button className="btn">Set category budget</button>
      </form>

      {budgets.length === 0 && <div className="glass p-8 text-center text-slate-400">No category budgets yet. Choose a category and a monthly limit above to create one.</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {budgets.map((b) => {
          const s = spent[b.category] || 0, p = Math.round((s / b.amount) * 100), st = status(p);
          return (<div key={b.id} className="glass p-5">
            <div className="mb-2 flex items-center justify-between"><b>{b.category}</b>
              <button aria-label={`Delete ${b.category} budget`} className="p-1 text-slate-400 hover:text-red-400" onClick={() => remove(b)}><Trash2 size={16} /></button></div>
            <div className="mb-1 flex flex-wrap justify-between text-sm"><span>{money(s)} of {money(b.amount)} ({p}%)</span><span className={st.text}>{st.label}</span></div>
            <div className="h-3 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${st.bar}`} style={{ width: `${Math.min(100, p)}%` }} /></div>
            <div className="mt-1 text-xs text-slate-400">{s > b.amount ? `${money(s - b.amount)} over` : `${money(b.amount - s)} remaining`}</div>
          </div>);
        })}
      </div>
    </div>
  );
}