import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Receipt, PiggyBank, UserCircle, Users, LogOut, Wallet, BarChart3, Calculator, TrendingDown, FileText, ScanLine, Lightbulb } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const userLinks = [
  ["/dashboard", "Dashboard", LayoutDashboard], 
  ["/expenses", "Expenses", Receipt],
    ["/add-receipt", "Scan receipt", ScanLine],
    ["/analytics", "Analytics", BarChart3],
      ["/insights", "Insights", Lightbulb],
  ["/budget", "Budget", PiggyBank],
  ["/profile", "Profile", UserCircle],
    ["/affordability", "Can I afford this?", Calculator],
  ["/what-if", "What-if", TrendingDown],
    ["/reports", "Reports", FileText],
];
export default function AppLayout() {
  const { isAdmin, logout, profile } = useAuth();
  const nav = useNavigate();
  const links = isAdmin ? [...userLinks, ["/admin/users", "Admin: Users", Users]] : userLinks;
  const cls = ({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? "bg-mint/15 text-mint" : "text-slate-300 hover:bg-white/5"}`;
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-4 md:flex-row">
      <aside className="glass flex gap-1 p-3 md:sticky md:top-4 md:h-[calc(100vh-2rem)] md:w-60 md:flex-col md:self-start">
        <div className="hidden items-center gap-2 px-3 py-3 md:flex">
          <img src="/logo-icon.png" alt="" className="h-9 w-9 object-contain" /><b className="text-lg">SmartSpend</b></div>
        <nav className="flex flex-1 gap-1 overflow-x-auto md:flex-col">
          {links.map(([to, label, Icon]) => <NavLink key={to} to={to} className={cls}><Icon size={18} />{label}</NavLink>)}
        </nav>
        <div className="hidden px-3 pb-2 text-xs text-slate-400 md:block">{profile?.email}</div>
        <button className="btn-ghost" onClick={async () => { await logout(); nav("/login"); }}><LogOut size={16} /><span className="hidden md:inline">Log out</span></button>
      </aside>
      <main className="min-w-0 flex-1"><Outlet /></main>
    </div>
  );
}
