import { useEffect, useMemo, useState } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { CATEGORIES } from "./Expenses";
import { monthKey, monthBounds, shiftMonth } from "../utils/dates";

const COLORS = ["#2dd4a7", "#38bdf8", "#818cf8", "#f59e0b", "#f472b6", "#a3e635", "#fb7185", "#22d3ee", "#94a3b8"];
const tip = { contentStyle: { background: "#111b2e", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12 }, labelStyle: { color: "#fff" } };

// Reads only this user's expenses for one month.
async function fetchMonth(uid, key) {
  const { start, end } = monthBounds(key);
  const s = await getDocs(query(collection(db, "expenses"),
    where("userId", "==", uid), where("date", ">=", start), where("date", "<=", end), orderBy("date", "desc")));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export default function Analytics() {
  const { user, profile } = useAuth();
  const cur = profile.currency;
  const [month, setMonth] = useState(monthKey(new Date()));
  const [cat, setCat] = useState("All");
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let live = true; setData(null); setErr(false);
    Promise.all([fetchMonth(user.uid, month), fetchMonth(user.uid, shiftMonth(month, -1))])
      .then(([now, prev]) => live && setData({ now, prev }))
      .catch((e) => { console.error(e); live && setErr(true); });
    return () => { live = false; };
  }, [user.uid, month]);

  const calc = useMemo(() => {
    if (!data) return null;
    const pick = (rows) => (cat === "All" ? rows : rows.filter((r) => r.category === cat));
    const now = pick(data.now), prev = pick(data.prev);
    const sum = (a) => a.reduce((t, r) => t + r.amount, 0);
    const { days } = monthBounds(month);
    const today = new Date(), thisMonth = monthKey(today);
    const daysCounted = month > thisMonth ? 0 : month === thisMonth ? today.getDate() : days;
    const total = sum(now), prevTotal = sum(prev);

    const daily = Array.from({ length: days }, (_, i) => ({ day: String(i + 1), total: 0 }));
    now.forEach((r) => { daily[Number(r.date.slice(8)) - 1].total += r.amount; });
    const weeks = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"].slice(0, Math.ceil(days / 7)).map((week) => ({ week, total: 0 }));
    now.forEach((r) => { weeks[Math.floor((Number(r.date.slice(8)) - 1) / 7)].total += r.amount; });

    const names = [...new Set([...now, ...prev].map((r) => r.category))];
    const compare = names.map((name) => ({ name, "This month": sum(now.filter((r) => r.category === name)), "Last month": sum(prev.filter((r) => r.category === name)) }));
    const pie = compare.map((c) => ({ name: c.name, value: c["This month"] })).filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
    const top = [...now].sort((a, b) => b.amount - a.amount).slice(0, 5);
    const change = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
    return { count: now.length, total, prevTotal, avg: daysCounted ? total / daysCounted : 0, daysCounted, daily, weeks, compare, pie, top, change };
  }, [data, cat, month]);

  const money = (n) => `${cur} ${Math.round(n).toLocaleString()}`;
  const Card = ({ t, v, s }) => <div className="glass p-5"><div className="text-xs font-semibold text-slate-400">{t}</div><div className="mt-1 text-2xl font-extrabold">{v}</div>{s && <div className="text-xs text-slate-400">{s}</div>}</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Analytics</h1>
      <div className="glass flex flex-wrap items-end gap-3 p-3">
        <div><label className="label">Month</label><input className="input" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></div>
        <div><label className="label">Category</label><select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>{["All", ...CATEGORIES].map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>

      {err && <div className="glass p-6">Could not load analytics. If the browser console mentions an index, open the link in it to create the index, wait two minutes, then reload.</div>}
      {!err && !calc && <div className="glass h-64 animate-pulse" />}

      {calc && calc.count === 0 && <div className="glass p-10 text-center text-slate-400">No expenses found for this month{cat !== "All" ? ` in ${cat}` : ""}. Pick another month or add expenses first.</div>}

      {calc && calc.count > 0 && (<>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card t="Total spent" v={money(calc.total)} s={`${calc.count} expenses`} />
          <Card t="Average per day" v={money(calc.avg)} s={`over ${calc.daysCounted} days`} />
          <Card t="Versus last month" v={calc.change === null ? "No data" : `${calc.change > 0 ? "+" : ""}${calc.change}%`} s={calc.change === null ? "Nothing recorded last month to compare" : `Last month: ${money(calc.prevTotal)}`} />
          <Card t="Highest category" v={calc.pie[0]?.name || "None"} s={calc.pie[0] ? money(calc.pie[0].value) : ""} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="glass h-72 p-4"><b className="text-sm">Daily spending</b>
            <ResponsiveContainer><BarChart data={calc.daily}><XAxis dataKey="day" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip {...tip} /><Bar dataKey="total" fill="#2dd4a7" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
          <div className="glass h-72 p-4"><b className="text-sm">Weekly spending</b>
            <ResponsiveContainer><BarChart data={calc.weeks}><XAxis dataKey="week" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip {...tip} /><Bar dataKey="total" fill="#38bdf8" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
          <div className="glass h-72 p-4"><b className="text-sm">Category distribution</b>
            <ResponsiveContainer><PieChart><Pie data={calc.pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}>{calc.pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip {...tip} /><Legend /></PieChart></ResponsiveContainer></div>
          <div className="glass h-72 p-4"><b className="text-sm">This month vs last month, by category</b>
            <ResponsiveContainer><BarChart data={calc.compare}><XAxis dataKey="name" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip {...tip} /><Legend /><Bar dataKey="This month" fill="#2dd4a7" radius={[4, 4, 0, 0]} /><Bar dataKey="Last month" fill="#818cf8" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </div>

        <div className="glass overflow-x-auto"><div className="p-4 pb-0 text-sm font-bold">Top 5 expenses</div>
          <table className="w-full text-sm"><thead className="text-left text-slate-400"><tr>{["Date", "Merchant", "Category", "Amount"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
            <tbody>{calc.top.map((r) => <tr key={r.id} className="border-t border-white/5"><td className="p-3">{r.date}</td><td className="p-3">{r.merchant}</td><td className="p-3">{r.category}</td><td className="p-3 font-bold">{money(r.amount)}</td></tr>)}</tbody></table></div>
      </>)}

      <div className="glass p-5 text-sm text-slate-400">
        <b className="text-slate-200">How these numbers are calculated</b>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Everything uses only your own expenses for the selected month and category.</li>
          <li>Average per day = total spent divided by the days elapsed. For the current month that is today's date, so the average isn't pulled down by days that haven't happened.</li>
          <li>Versus last month = (this month minus last month) divided by last month. It shows "No data" when last month has no expenses, so you never see a misleading percentage.</li>
          <li>Weeks are fixed blocks: days 1–7, 8–14, 15–21, 22–28 and 29 onward.</li>
        </ul>
      </div>
    </div>
  );
}