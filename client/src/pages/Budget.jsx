import { Link } from "react-router-dom";
import { PiggyBank } from "lucide-react";
export default function Budget() {
  return <div className="glass p-8"><PiggyBank className="mb-3 text-mint" /><h1 className="text-xl font-extrabold">Budgets</h1>
    <p className="mt-2 text-sm text-slate-400">Your overall monthly budget is set on the <Link className="text-mint" to="/profile">Profile</Link> page and shown on the Dashboard. Per-category budgets are planned for the next phase.</p></div>;
}
