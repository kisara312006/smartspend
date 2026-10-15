import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile, sendEmailVerification, sendPasswordResetEmail } from "firebase/auth";
import toast from "react-hot-toast";
import { db, storage, auth } from "../firebase/config";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, profile, isAdmin, refreshProfile } = useAuth();
  const [name, setName] = useState(profile.name); const [currency, setCurrency] = useState(profile.currency);
  const [budget, setBudget] = useState(profile.monthlyBudget || 0); const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required.");
    if (Number(budget) < 0) return toast.error("Budget cannot be negative.");
    setBusy(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { name: name.trim(), currency, monthlyBudget: Number(budget), updatedAt: serverTimestamp() });
      await updateProfile(auth.currentUser, { displayName: name.trim() }); await refreshProfile(); toast.success("Profile saved");
    } catch { toast.error("Could not save profile."); } setBusy(false);
  };
  const upload = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (!f.type.startsWith("image/") || f.size > 2 * 1024 * 1024) return toast.error("Choose an image under 2 MB.");
    try {
      const r = ref(storage, `profilePictures/${user.uid}/avatar`); await uploadBytes(r, f);
      await updateDoc(doc(db, "users", user.uid), { photoURL: await getDownloadURL(r), updatedAt: serverTimestamp() });
      await refreshProfile(); toast.success("Photo updated");
    } catch { toast.error("Upload failed."); }
  };
  const Row = ({ k, v }) => <div className="flex justify-between border-b border-white/5 py-2 text-sm"><span className="text-slate-400">{k}</span><span>{v}</span></div>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="glass p-6">
        <div className="mb-4 flex items-center gap-4">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-white/10 text-2xl font-bold">{profile.photoURL ? <img src={profile.photoURL} alt="" className="h-full w-full object-cover" /> : (profile.name || "?")[0]}</div>
          <label className="btn-ghost cursor-pointer">Change photo<input type="file" accept="image/*" hidden onChange={upload} /></label>
        </div>
        <Row k="Email" v={profile.email} /><Row k="Sign-in method" v={profile.provider} />
        <Row k="Email verified" v={user.emailVerified ? "Yes" : "No"} /><Row k="Role" v={isAdmin ? "Administrator" : "User"} />
        <Row k="Joined" v={user.metadata.creationTime?.slice(0, 16)} />
        <div className="mt-4 flex flex-wrap gap-2">
          {!user.emailVerified && <button className="btn-ghost" onClick={() => sendEmailVerification(user).then(() => toast.success("Verification email sent"))}>Verify email</button>}
          <button className="btn-ghost" onClick={() => sendPasswordResetEmail(auth, profile.email).then(() => toast.success("Reset link sent"))}>Change password</button>
        </div>
      </div>
      <form onSubmit={save} className="glass space-y-4 p-6">
        <h2 className="font-bold">Preferences</h2>
        <div><label className="label">Full name</label><input className="input" value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label className="label">Currency</label><select className="input" value={currency} onChange={e => setCurrency(e.target.value)}>{["LKR", "USD", "EUR", "GBP", "INR"].map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label className="label">Monthly budget</label><input className="input" type="number" min="0" value={budget} onChange={e => setBudget(e.target.value)} /></div>
        <button className="btn" disabled={busy}>Save changes</button>
      </form>
    </div>
  );
}
