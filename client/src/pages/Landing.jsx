import { Link } from "react-router-dom";
import { Wallet, LineChart, ShieldCheck } from "lucide-react";
export default function Landing() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-20 flex items-center justify-between"><div className="flex items-center gap-2 text-lg font-extrabold"><Wallet className="text-mint" />SmartSpend</div>
        <div className="flex gap-2"><Link className="btn-ghost" to="/login">Log in</Link><Link className="btn" to="/register">Get started</Link></div></div>
      <h1 className="max-w-3xl text-5xl font-extrabold leading-tight md:text-6xl">Know where your money went, and why it changed.</h1>
      <p className="mt-5 max-w-xl text-lg text-slate-300">Track expenses, set budgets, and see your spending patterns in one place.</p>
      <div className="mt-8"><Link className="btn" to="/register">Create free account</Link></div>
      <div className="mt-20 grid gap-4 md:grid-cols-3">
        {[[Wallet, "Track every expense", "Add, search and filter your spending history."], [LineChart, "See the patterns", "Charts built from your own data."], [ShieldCheck, "Private by design", "Only you can read your records."]].map(([I, t, d]) =>
          <div key={t} className="glass p-5"><I className="mb-3 text-mint" /><h3 className="font-bold">{t}</h3><p className="mt-1 text-sm text-slate-400">{d}</p></div>)}
      </div>
    </div>
  );
}
