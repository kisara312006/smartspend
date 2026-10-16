import { useState } from "react";
import { FileText, FileSpreadsheet } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { localISO, monthBounds } from "../utils/dates";
import { fetchRange } from "../utils/spending";
import { buildPDF, buildExcel, categoryTotals } from "../utils/reports";

const TYPES = ["Daily", "Weekly", "Monthly", "Custom"];

function weekOf(iso) {                       // Monday to Sunday containing the chosen date
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const mon = new Date(dt); mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { start: localISO(mon), end: localISO(sun) };
}

export default function Reports() {
  const { user, profile } = useAuth();
  const cur = profile.currency;
  const today = localISO(new Date());
  const [type, setType] = useState("Monthly");
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [rep, setRep] = useState(null);

  const range = () => {
    if (type === "Daily") return { start: day, end: day };
    if (type === "Weekly") return weekOf(day);
    if (type === "Monthly") { const b = monthBounds(month); return { start: b.start, end: b.end }; }
    return { start: from, end: to };
  };

  const load = async () => {
    const { start, end } = range();
    if (!start || !end) return toast.error("Choose a date first.");
    if (start > end) return toast.error("The start date must be before the end date.");
    if ((new Date(end) - new Date(start)) / 864e5 > 366) return toast.error("Choose a period of one year or less.");
    setBusy(true);
    try {
      const rows = (await fetchRange(user.uid, start, end)).sort((a, b) => a.date.localeCompare(b.date));
      setRep({ rows, start, end, label: type });
    } catch (e) { console.error(e); toast.error("Could not load expenses. Check the browser console."); }
    setBusy(false);
  };

  const money = (n) => `${cur} ${Math.round(n).toLocaleString()}`;
  const total = rep ? rep.rows.reduce((t, r) => t + r.amount, 0) : 0;
  const cats = rep ? categoryTotals(rep.rows) : [];
  const dl = (fn) => { try { fn({ ...rep, cur, name: profile.name }); toast.success("Report downloaded"); } catch (e) { console.error(e); toast.error("Could not create the file."); } };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Reports</h1>
      <p className="text-sm text-slate-400">Choose a period, check the summary, then download it as a PDF or Excel file.</p>

      <div className="glass flex flex-wrap items-end gap-3 p-5">
        <div><label className="label">Report type</label><select className="input" value={type} onChange={(e) => { setType(e.target.value); setRep(null); }}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
        {(type === "Daily" || type === "Weekly") && <div><label className="label">{type === "Weekly" ? "Any date in the week" : "Date"}</label><input className="input" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></div>}
        {type === "Monthly" && <div><label className="label">Month</label><input className="input" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></div>}
        {type === "Custom" && <>
          <div><label className="label">From</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label">To</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div></>}
        <button className="btn" onClick={load} disabled={busy}>{busy ? "Loading…" : "Preview report"}</button>
      </div>

      {rep && rep.rows.length === 0 && <div className="glass p-8 text-center text-slate-400">No expenses between {rep.start} and {rep.end}. Choose another period.</div>}

      {rep && rep.rows.length > 0 && (<>
        <div className="glass p-5">
          <div className="text-xs text-slate-400">{rep.label} report: {rep.start} to {rep.end}</div>
          <div className="mt-1 text-2xl font-extrabold">{money(total)}</div>
          <div className="text-sm text-slate-400">{rep.rows.length} expenses. Highest category: {cats[0].name}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn" onClick={() => dl(buildPDF)}><FileText size={16} />Download PDF</button>
            <button className="btn-ghost" onClick={() => dl(buildExcel)}><FileSpreadsheet size={16} />Download Excel</button>
          </div>
        </div>
        <div className="glass overflow-x-auto">
          <table className="w-full text-sm"><thead className="text-left text-slate-400"><tr>{["Category", "Total", "Share"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
            <tbody>{cats.map((c) => <tr key={c.name} className="border-t border-white/5"><td className="p-3">{c.name}</td><td className="p-3">{money(c.value)}</td><td className="p-3">{Math.round((c.value / total) * 100)}%</td></tr>)}</tbody></table>
        </div>
      </>)}
    </div>
  );
}