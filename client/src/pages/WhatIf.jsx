import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "../context/AuthContext";
import { CATEGORIES } from "./Expenses";
import { monthKey, monthBounds, shiftMonth } from "../utils/dates";
import { fetchRange } from "../utils/spending";

export default function WhatIf() {
  const { user, profile } = useAuth();
  const cur = profile.currency;
  const money = (n) => `${cur} ${Math.round(n).toLocaleString()}`;

  const [cat, setCat] = useState("Food");
  const [cut, setCut] = useState("3000");
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    // Your last three full months, used only to learn your usual spending.
    const key = monthKey(new Date());
    fetchRange(user.uid, monthBounds(shiftMonth(key, -3)).start, monthBounds(shiftMonth(key, -1)).end)
      .then(setRows).catch((e) => { console.error(e); setErr(true); });
  }, [user.uid]);

  const calc = useMemo(() => {
    if (!rows) return null;
    const months = new Set(rows.map((r) => r.date.slice(0, 7))).size;
    const catTotal = rows.filter((r) => r.category === cat).reduce((t, r) => t + r.amount, 0);
    const avg = months > 0 ? catTotal / months : null;
    const wanted = Math.max(0, Number(cut) || 0);
    const capped = avg !== null && wanted > avg;
    const monthly = avg === null ? wanted : Math.min(wanted, avg);
    const chart = Array.from({ length: 12 }, (_, i) => ({ month: `M${i + 1}`, saved: monthly * (i + 1) }));
    return { months, avg, wanted, capped, monthly, chart, pct: avg ? Math.round((monthly / avg) * 100) : null };
  }, [rows, cat, cut]);

  if (err) return <div className="glass p-6">Could not load your spending history. Check the browser console for details.</div>;
  if (!calc) return <div className="glass h-64 animate-pulse" />;

  const Card = ({ t, v }) => <div className="glass p-5"><div className="text-xs font-semibold text-slate-400">{t}</div><div className="mt-1 text-2xl font-extrabold">{v}</div></div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">What-if simulator</h1>
      <p className="text-sm text-slate-400">See how much you could save if you spend less in one category.</p>

      <div className="glass flex flex-wrap items-end gap-3 p-5">
        <div><label className="label">Category</label><select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className="label">Reduce by, per month ({cur})</label><input className="input" type="number" min="0" value={cut} onChange={(e) => setCut(e.target.value)} /></div>
      </div>

      <div className="glass p-4 text-sm text-slate-300">
        {calc.avg === null
          ? "You have no expenses in the last three full months, so these figures are purely hypothetical."
          : `Your usual ${cat} spending is about ${money(calc.avg)} per month, averaged over ${calc.months} month${calc.months > 1 ? "s" : ""} of data.`}
        {calc.capped && ` You entered more than you usually spend, so the savings below are limited to ${money(calc.monthly)}.`}
        {calc.pct !== null && !calc.capped && calc.pct > 0 && ` That is a ${calc.pct}% reduction.`}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card t="Estimated monthly savings" v={money(calc.monthly)} />
        <Card t="Estimated 6-month savings" v={money(calc.monthly * 6)} />
        <Card t="Estimated 12-month savings" v={money(calc.monthly * 12)} />
      </div>

      <div className="glass h-72 p-4"><b className="text-sm">Cumulative savings over 12 months</b>
        <ResponsiveContainer><BarChart data={calc.chart}><XAxis dataKey="month" stroke="#64748b" /><YAxis stroke="#64748b" />
          <Tooltip formatter={(v) => money(v)} contentStyle={{ background: "#111b2e", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12 }} labelStyle={{ color: "#fff" }} />
          <Bar dataKey="saved" fill="#2dd4a7" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>

      <div className="glass p-5 text-xs text-slate-400">
        <b className="text-slate-200">Hypothetical only.</b> Savings = the monthly reduction multiplied by the number of months. It assumes you really spend that much less every month and that nothing else changes. These are calculations, not guaranteed outcomes.
      </div>
    </div>
  );
}