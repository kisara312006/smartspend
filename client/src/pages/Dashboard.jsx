import { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { localISO as iso } from "../utils/dates";

const COLORS = ["#2dd4a7", "#38bdf8", "#818cf8", "#f59e0b", "#f472b6", "#a3e635", "#fb7185", "#22d3ee", "#94a3b8"];


export default function Dashboard() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState(null); const [err, setErr] = useState(false);
  const now = new Date(); const monthStart = iso(new Date(now.getFullYear(), now.getMonth(), 1));

  useEffect(() => {
    // Only this month's expenses of THIS user are fetched, not the whole history.
    getDocs(query(collection(db, "expenses"), where("userId", "==", user.uid), where("date", ">=", monthStart), orderBy("date", "desc")))
      .then(s => setRows(s.docs.map(d => ({ id: d.id, ...d.data() })))).catch((e) => { console.error(e); setErr(true); });
  }, [user.uid, monthStart]);

  if (err) return <div className="glass p-6">Could not load your data. If this is the first run, create the Firestore index shown in the browser console.</div>;
  if (!rows) return <div className="glass h-64 animate-pulse" />;

  const today = iso(now); const weekAgo = iso(new Date(now.getTime() - 6 * 864e5));
  const sum = (a) => a.reduce((t, r) => t + r.amount, 0);
  const month = sum(rows), todayT = sum(rows.filter(r => r.date === today)), week = sum(rows.filter(r => r.date >= weekAgo));
  const byCat = Object.entries(rows.reduce((m, r) => ({ ...m, [r.category]: (m[r.category] || 0) + r.amount }), {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const byDay = Object.entries(rows.reduce((m, r) => ({ ...m, [r.date.slice(8)]: (m[r.date.slice(8)] || 0) + r.amount }), {})).map(([day, total]) => ({ day, total })).sort((a, b) => a.day - b.day);
  const budget = profile.monthlyBudget || 0; const pct = budget ? Math.min(100, Math.round(month / budget * 100)) : 0;
  const cur = profile.currency;
  const Card = ({ t, v, s }) => <div className="glass p-5"><div className="text-xs font-semibold text-slate-400">{t}</div><div className="mt-1 text-2xl font-extrabold">{v}</div>{s && <div className="text-xs text-slate-400">{s}</div>}</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Hi{profile.name ? `, ${profile.name.split(" ")[0]}` : ""}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card t="Today" v={`${cur} ${todayT.toLocaleString()}`} /><Card t="Last 7 days" v={`${cur} ${week.toLocaleString()}`} />
        <Card t="This month" v={`${cur} ${month.toLocaleString()}`} s={`${rows.length} expenses`} />
        <Card t="Top category" v={byCat[0]?.name || "None yet"} s={byCat[0] ? `${cur} ${byCat[0].value.toLocaleString()}` : ""} />
      </div>
      <div className="glass p-5"><div className="mb-2 flex justify-between text-sm"><b>Monthly budget</b><span className="text-slate-400">{budget ? `${cur} ${Math.max(0, budget - month).toLocaleString()} left` : "Set a budget in Profile"}</span></div>
        <div className="h-3 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${pct >= 100 ? "bg-red-400" : pct >= 80 ? "bg-amber-400" : "bg-mint"}`} style={{ width: `${pct}%` }} /></div></div>
      {rows.length === 0 ? <div className="glass p-10 text-center text-slate-400">No expenses this month. Add one from the Expenses page to see charts here.</div> :
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="glass h-72 p-4"><b className="text-sm">Spending by category</b><ResponsiveContainer><PieChart><Pie data={byCat} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}>{byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
          <div className="glass h-72 p-4"><b className="text-sm">Daily spending</b><ResponsiveContainer><BarChart data={byDay}><XAxis dataKey="day" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip /><Bar dataKey="total" fill="#2dd4a7" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </div>}
    </div>
  );
}
