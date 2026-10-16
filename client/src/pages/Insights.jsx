import { useEffect, useState, useCallback } from "react";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { TrendingUp, TrendingDown, AlertTriangle, Info, CheckCircle2, Save, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { localISO, monthKey, monthBounds, shiftMonth } from "../utils/dates";
import { fetchRange } from "../utils/spending";
import { analyze } from "../utils/insights";

// Each tone has an icon, a word and a colour, so meaning never depends on colour alone.
const TONES = {
  up: { Icon: TrendingUp, word: "Increase", bar: "border-amber-400", text: "text-amber-300" },
  down: { Icon: TrendingDown, word: "Decrease", bar: "border-sky-400", text: "text-sky-300" },
  warn: { Icon: AlertTriangle, word: "Attention", bar: "border-red-400", text: "text-red-300" },
  good: { Icon: CheckCircle2, word: "On track", bar: "border-mint", text: "text-mint" },
  neutral: { Icon: Info, word: "Info", bar: "border-slate-500", text: "text-slate-300" },
};

function SummaryView({ s }) {
  const money = (n) => `${s.cur} ${Math.round(n).toLocaleString()}`;
  const Card = ({ t, v, sub }) => <div className="glass p-5"><div className="text-xs font-semibold text-slate-400">{t}</div><div className="mt-1 text-xl font-extrabold">{v}</div>{sub && <div className="text-xs text-slate-400">{sub}</div>}</div>;
  if (!s.enough) return <div className="glass p-10 text-center text-slate-400">No expenses recorded for this month yet, so there is nothing to analyse.</div>;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-bold text-slate-300">Calculated figures</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card t={s.partial ? `Spent (first ${s.cutoffDay} days)` : "Total spent"} v={money(s.total)} sub={`${s.count} expenses`} />
          <Card t="Versus last month" v={s.changePct === null ? "No data" : `${s.changePct > 0 ? "+" : ""}${s.changePct}%`} sub={s.changePct === null ? "Nothing to compare with" : `${s.partial ? "Same days last month" : "Last month"}: ${money(s.prevTotal)}`} />
          <Card t="Top category" v={s.topCategory.name} sub={`${money(s.topCategory.amount)} (${s.topCategory.share}%)`} />
          <Card t="Largest expense" v={money(s.largest.amount)} sub={`${s.largest.merchant}, ${s.largest.date}`} />
        </div>
      </div>
      {s.budget && (
        <div className="glass p-5">
          <div className="mb-1 flex justify-between text-sm"><b>Monthly budget</b><span className="text-slate-400">{money(s.budget.spent)} of {money(s.budget.limit)} ({s.budget.pct}%)</span></div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${s.budget.pct >= 100 ? "bg-red-400" : s.budget.pct >= 80 ? "bg-amber-400" : "bg-mint"}`} style={{ width: `${Math.min(100, s.budget.pct)}%` }} /></div>
        </div>)}
      <div>
        <h3 className="mb-2 text-sm font-bold text-slate-300">What stands out</h3>
        <div className="space-y-3">
          {s.insights.map((i, k) => { const T = TONES[i.tone] || TONES.neutral; return (
            <div key={k} className={`glass flex gap-3 border-l-4 p-4 ${T.bar}`}>
              <T.Icon size={20} className={`mt-0.5 shrink-0 ${T.text}`} aria-hidden="true" />
              <div><div className="text-sm font-bold">{i.title} <span className={`ml-1 text-xs font-semibold ${T.text}`}>{T.word}</span></div><p className="mt-0.5 text-sm text-slate-300">{i.text}</p></div>
            </div>); })}
        </div>
      </div>
      {s.notes.length > 0 && <div className="glass space-y-1 p-4 text-sm text-slate-400">{s.notes.map((n, k) => <p key={k}>{n}</p>)}</div>}
    </div>
  );
}

export default function Insights() {
  const { user, profile } = useAuth();
  const cur = profile.currency;
  const [month, setMonth] = useState(monthKey(new Date()));
  const [live, setLive] = useState(null);
  const [err, setErr] = useState(false);
  const [saved, setSaved] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadSaved = useCallback(async () => {
    try {
      const s = await getDocs(query(collection(db, "monthlySummaries"), where("userId", "==", user.uid)));
      setSaved(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.month.localeCompare(a.month)));
    } catch (e) { console.error(e); }
  }, [user.uid]);
  useEffect(() => { loadSaved(); }, [loadSaved]);

  useEffect(() => {
    let alive = true; setLive(null); setErr(false);
    (async () => {
      try {
        const [rows, b] = await Promise.all([
          fetchRange(user.uid, monthBounds(shiftMonth(month, -3)).start, monthBounds(month).end),
          getDocs(query(collection(db, "budgets"), where("userId", "==", user.uid))),
        ]);
        if (alive) setLive(analyze({ month, rows, todayISO: localISO(new Date()), budget: profile.monthlyBudget || 0, catBudgets: b.docs.map((d) => d.data()), cur }));
      } catch (e) { console.error(e); if (alive) setErr(true); }
    })();
    return () => { alive = false; };
  }, [user.uid, month, profile.monthlyBudget, cur]);

  const save = async () => {
    setSaving(true);
    try {
      const { month: m, cur: c, total, prevTotal, changePct, count, partial, cutoffDay, topCategory, largest, categories, insights, notes, budget } = live;
      await setDoc(doc(db, "monthlySummaries", `${user.uid}_${m}`), {
        userId: user.uid, month: m, currency: c, total, prevTotal, changePct, count, partial, cutoffDay, topCategory, largest,
        categories: categories.map(({ name, amount, prev, delta, share }) => ({ name, amount, prev, delta, share })),
        insights, notes, budget, generatedAt: serverTimestamp(),
      });
      toast.success(`Summary for ${m} saved`); loadSaved();
    } catch (e) { console.error(e); toast.error("Could not save the summary. Have the Firestore rules been deployed?"); }
    setSaving(false);
  };

  const open = (s) => setViewing({ ...s, cur: s.currency, enough: true });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Insights and monthly summary</h1>
      <p className="text-sm text-slate-400">Worked out from your own expenses. Every figure comes from a calculation, not a guess.</p>

      {viewing ? (<>
        <button className="btn-ghost" onClick={() => setViewing(null)}><ArrowLeft size={16} />Back to this month's analysis</button>
        <div className="glass p-4 text-sm text-slate-300">Saved summary for <b>{viewing.month}</b>, created {viewing.generatedAt?.toDate?.().toLocaleDateString() || "earlier"}. The figures are as they were when it was saved.</div>
        <SummaryView s={viewing} />
      </>) : (<>
        <div className="glass flex flex-wrap items-end gap-3 p-4">
          <div><label className="label">Month</label><input className="input" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></div>
          <button className="btn" onClick={save} disabled={!live || !live.enough || saving}><Save size={16} />{saving ? "Saving…" : "Save as monthly summary"}</button>
        </div>
        {err && <div className="glass p-6">Could not load your expenses. If the browser console mentions an index, open the link in it and create the index.</div>}
        {!err && !live && <div className="glass h-64 animate-pulse" />}
        {live && <SummaryView s={live} />}
      </>)}

      <div className="glass p-5">
        <h2 className="mb-3 text-sm font-bold">Saved monthly summaries</h2>
        {saved.length === 0 ? <p className="text-sm text-slate-400">None yet. Choose a month above and save its summary to keep a record.</p> :
          <div className="divide-y divide-white/5">{saved.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span><b>{s.month}</b><span className="ml-3 text-slate-400">{s.currency} {Math.round(s.total).toLocaleString()}{s.changePct !== null && ` (${s.changePct > 0 ? "+" : ""}${s.changePct}% vs previous)`}</span></span>
              <button className="btn-ghost !py-1.5" onClick={() => open(s)}>View</button>
            </div>))}</div>}
      </div>

      <div className="glass p-5 text-xs text-slate-400">
        <b className="text-slate-200">How this is worked out</b>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>If the month is not finished, it is compared with the same number of days of the previous month, so a half month is never compared with a full one.</li>
          <li>A category is flagged when it changes by at least 20% and by at least 5% of your total spending. The shops behind an increase are the ones whose spending grew the most in that category.</li>
          <li>An expense is flagged as unusually high when it is far above your normal spread in that category over the previous 3 months. This needs at least 5 earlier expenses in the category.</li>
          <li>A merchant is listed as recurring when it appears in 3 of the last 4 months with similar monthly totals (within 15%).</li>
          <li>These are budgeting aids, not financial advice. Nothing here predicts the future.</li>
        </ul>
      </div>
    </div>
  );
}
