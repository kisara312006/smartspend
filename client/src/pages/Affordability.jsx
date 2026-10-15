import { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { CATEGORIES } from "./Expenses";
import { localISO, monthKey, monthBounds } from "../utils/dates";
import { fetchRange, sum } from "../utils/spending";

const LEVELS = {
  over: { label: "Over budget", cls: "text-red-300", border: "border-red-400/40" },
  tight: { label: "Tight", cls: "text-amber-300", border: "border-amber-400/40" },
  fits: { label: "Within budget", cls: "text-mint", border: "border-mint/40" },
};

export default function Affordability() {
  const { user, profile } = useAuth();
  const cur = profile.currency;
  const money = (n) => `${cur} ${Math.round(n).toLocaleString()}`;

  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState(CATEGORIES[0]);
  const [upcoming, setUpcoming] = useState([]);
  const [uLabel, setULabel] = useState("");
  const [uAmount, setUAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);

  const addUpcoming = () => {
    const n = Number(uAmount);
    if (!uLabel.trim() || !(n > 0)) return toast.error("Enter a name and an amount for the upcoming expense.");
    setUpcoming([...upcoming, { label: uLabel.trim(), amount: n }]); setULabel(""); setUAmount("");
  };

  const check = async (e) => {
    e.preventDefault();
    const n = Number(amount);
    if (!(n > 0)) return toast.error("Enter a purchase amount greater than 0.");
    setBusy(true);
    try {
      const today = new Date();
      const { start, end, days } = monthBounds(monthKey(today));
      const since = new Date(today); since.setDate(today.getDate() - 29);
      const [monthRows, recentRows, budgetSnap] = await Promise.all([
        fetchRange(user.uid, start, end),
        fetchRange(user.uid, localISO(since), localISO(today)),
        getDocs(query(collection(db, "budgets"), where("userId", "==", user.uid))),
      ]);

      const budget = profile.monthlyBudget || 0;
      const spent = sum(monthRows);
      const catSpent = sum(monthRows.filter((r) => r.category === cat));
      const catBudget = budgetSnap.docs.map((d) => d.data()).find((b) => b.category === cat)?.amount ?? null;
      const upcomingTotal = sum(upcoming);
      const remaining = budget - spent;
      const afterPurchase = remaining - n - upcomingTotal;

      const enoughData = recentRows.length >= 5;
      const dailyPace = sum(recentRows) / 30;
      const projectedRest = enoughData ? dailyPace * (days - today.getDate()) : null;
      const afterPace = projectedRest === null ? null : afterPurchase - projectedRest;

      const catAfter = catBudget === null ? null : catBudget - catSpent - n;
      let level = null;
      if (budget > 0 || catBudget !== null) {
        if ((budget > 0 && afterPurchase < 0) || (catAfter !== null && catAfter < 0)) level = "over";
        else if (budget > 0 && afterPace !== null && afterPace < 0) level = "tight";
        else level = "fits";
      }
      setRes({ n, cat, budget, spent, remaining, upcomingTotal, afterPurchase, enoughData, projectedRest, afterPace, catBudget, catSpent, catAfter, level });
    } catch (x) { console.error(x); toast.error("Could not load your data. Check the browser console."); }
    setBusy(false);
  };

  const Row = ({ k, v, strong }) => <div className="flex justify-between gap-4 border-b border-white/5 py-2 text-sm"><span className="text-slate-400">{k}</span><span className={strong ? "font-bold" : ""}>{v}</span></div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Can I afford this?</h1>
      <p className="text-sm text-slate-400">Compare a planned purchase with your budget and spending this month.</p>

      <form onSubmit={check} className="glass space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Purchase amount ({cur})</label><input className="input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><label className="label">Category</label><select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        </div>

        <div>
          <label className="label">Other expenses you know are coming this month (optional)</label>
          <div className="flex flex-wrap gap-2">
            <input className="input max-w-[12rem]" placeholder="e.g. Rent" value={uLabel} onChange={(e) => setULabel(e.target.value)} />
            <input className="input max-w-[9rem]" type="number" min="0" placeholder="Amount" value={uAmount} onChange={(e) => setUAmount(e.target.value)} />
            <button type="button" className="btn-ghost" onClick={addUpcoming}><Plus size={16} />Add</button>
          </div>
          {upcoming.length > 0 && <div className="mt-3 flex flex-wrap gap-2">
            {upcoming.map((u, i) => <span key={i} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
              {u.label}: {money(u.amount)}
              <button type="button" aria-label={`Remove ${u.label}`} onClick={() => setUpcoming(upcoming.filter((_, j) => j !== i))}><X size={12} /></button></span>)}
          </div>}
        </div>
        <button className="btn" disabled={busy}>{busy ? "Checking…" : "Check this purchase"}</button>
      </form>

      {res && (
        <div className="space-y-4">
          {res.level ? (
            <div className={`glass border p-5 ${LEVELS[res.level].border}`}>
              <div className={`text-lg font-extrabold ${LEVELS[res.level].cls}`}>{LEVELS[res.level].label}</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {res.budget > 0 && res.afterPurchase < 0 && <li>This purchase{res.upcomingTotal > 0 ? " and your upcoming expenses" : ""} would take you {money(-res.afterPurchase)} over your monthly budget.</li>}
                {res.budget > 0 && res.afterPurchase >= 0 && <li>It fits your remaining budget, leaving {money(res.afterPurchase)}.</li>}
                {res.budget > 0 && res.afterPurchase >= 0 && res.afterPace !== null && res.afterPace < 0 && <li>At your recent spending pace you could still run about {money(-res.afterPace)} over before the month ends.</li>}
                {res.budget > 0 && res.afterPurchase >= 0 && res.afterPace !== null && res.afterPace >= 0 && <li>At your recent spending pace there would still be about {money(res.afterPace)} left at month end.</li>}
                {res.budget > 0 && res.afterPurchase >= 0 && res.afterPace === null && <li>There isn't enough recent spending to estimate your pace for the rest of the month.</li>}
                {res.catAfter !== null && res.catAfter < 0 && <li>It would exceed your {res.cat} budget by {money(-res.catAfter)}.</li>}
                {res.catAfter !== null && res.catAfter >= 0 && <li>It leaves {money(res.catAfter)} of your {res.cat} budget.</li>}
                {res.budget === 0 && <li>Set a total monthly budget in Budgets to also check against your overall limit.</li>}
              </ul>
            </div>
          ) : (
            <div className="glass p-5 text-sm text-slate-300">You haven't set a monthly budget or a {res.cat} budget yet, so there is nothing to compare this purchase with. Set one on the Budgets page, then check again.</div>
          )}

          <div className="glass p-5">
            <b className="text-sm">The numbers behind this</b>
            <div className="mt-2">
              <Row k="Spent this month" v={money(res.spent)} />
              {res.budget > 0 && <Row k="Monthly budget" v={money(res.budget)} />}
              {res.budget > 0 && <Row k="Remaining now" v={money(res.remaining)} />}
              <Row k="This purchase" v={money(res.n)} />
              {res.upcomingTotal > 0 && <Row k="Upcoming expenses you entered" v={money(res.upcomingTotal)} />}
              {res.budget > 0 && <Row k="Left after both" v={money(res.afterPurchase)} strong />}
              {res.budget > 0 && res.projectedRest !== null && <Row k="Estimated rest-of-month spending (recent pace)" v={money(res.projectedRest)} />}
              {res.budget > 0 && res.afterPace !== null && <Row k="Estimated left at month end" v={money(res.afterPace)} strong />}
              {res.catBudget !== null && <Row k={`${res.cat} budget used so far`} v={`${money(res.catSpent)} of ${money(res.catBudget)}`} />}
            </div>
          </div>
        </div>
      )}

      <div className="glass p-5 text-xs text-slate-400">
        <b className="text-slate-200">How this works.</b> It uses only your own expenses and budgets. The recent pace is your total spending over the last 30 days divided by 30, multiplied by the days left this month. It is an estimate, not a prediction. This tool is a budgeting aid, not financial advice, and it cannot guarantee that a purchase is affordable.
      </div>
    </div>
  );
}