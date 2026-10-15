import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import { db } from "../firebase/config";

export default function AdminUsers() {
  const [users, setUsers] = useState(null); const [q, setQ] = useState("");

  const load = async () => {
    try {
      const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(200)));
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    } catch (e) { console.error(e); toast.error("Could not load users."); setUsers([]); }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (u) => {
    const suspend = !u.suspended;
    if (!window.confirm(`${suspend ? "Suspend" : "Restore"} ${u.email}?`)) return;
    try {
      await updateDoc(doc(db, "users", u.uid), { suspended: suspend, updatedAt: serverTimestamp() });
      toast.success(suspend ? "Account suspended" : "Account restored"); load();
    } catch { toast.error("Could not update the account."); }
  };

  const shown = (users || []).filter(u => ((u.email || "") + (u.name || "")).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Users</h1>
      <input className="input max-w-xs" placeholder="Search name or email" value={q} onChange={e => setQ(e.target.value)} />
      <div className="glass overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-400"><tr>{["Name", "Email", "Sign-in", "Joined", "Status", ""].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>{shown.map(u => (
            <tr key={u.uid} className="border-t border-white/5">
              <td className="p-3">{u.name || "—"}</td><td className="p-3">{u.email}</td><td className="p-3">{u.provider}</td>
              <td className="p-3">{u.createdAt?.toDate?.().toLocaleDateString() || "—"}</td>
              <td className="p-3">{u.suspended ? "Suspended" : "Active"}</td>
              <td className="p-3 text-right"><button className="btn-ghost" onClick={() => toggle(u)}>{u.suspended ? "Restore" : "Suspend"}</button></td>
            </tr>))}</tbody>
        </table>
        {users === null && <p className="p-6 text-center text-slate-400">Loading…</p>}
        {users && shown.length === 0 && <p className="p-6 text-center text-slate-400">No users found.</p>}
      </div>
    </div>
  );
}