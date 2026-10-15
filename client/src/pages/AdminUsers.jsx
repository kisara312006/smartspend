import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import toast from "react-hot-toast";
import { functions } from "../firebase/config";

const call = (n, d) => httpsCallable(functions, n)(d).then(r => r.data);

export default function AdminUsers() {
  const [users, setUsers] = useState(null); const [q, setQ] = useState("");
  const load = () => call("adminListUsers").then(setUsers).catch(() => { toast.error("Could not load users. Are the Cloud Functions deployed?"); setUsers([]); });
  useEffect(() => { load(); }, []);
  const toggle = async (u) => { try { await call("adminSetDisabled", { uid: u.uid, disabled: !u.disabled }); toast.success(u.disabled ? "Account restored" : "Account suspended"); load(); } catch (e) { toast.error(e.message); } };
  const del = async (u) => { if (!window.confirm(`Permanently delete ${u.email} and all their expenses?`)) return; try { await call("adminDeleteUser", { uid: u.uid }); toast.success("User deleted"); load(); } catch (e) { toast.error(e.message); } };
  const shown = (users || []).filter(u => (u.email + u.name).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Users</h1>
      <input className="input max-w-xs" placeholder="Search name or email" value={q} onChange={e => setQ(e.target.value)} />
      <div className="glass overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-slate-400"><tr>{["Name", "Email", "Verified", "Role", "Status", ""].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
        <tbody>{shown.map(u => <tr key={u.uid} className="border-t border-white/5"><td className="p-3">{u.name || "—"}</td><td className="p-3">{u.email}</td><td className="p-3">{u.verified ? "Yes" : "No"}</td>
          <td className="p-3">{u.isAdmin ? "Admin" : "User"}</td><td className="p-3">{u.disabled ? "Suspended" : "Active"}</td>
          <td className="p-3 text-right"><button className="btn-ghost mr-2" onClick={() => toggle(u)}>{u.disabled ? "Restore" : "Suspend"}</button><button className="btn-ghost text-red-300" onClick={() => del(u)}>Delete</button></td></tr>)}</tbody></table>
        {users === null && <p className="p-6 text-center text-slate-400">Loading…</p>}{users && shown.length === 0 && <p className="p-6 text-center text-slate-400">No users found.</p>}</div>
    </div>
  );
}
