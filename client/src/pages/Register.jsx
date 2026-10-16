import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "firebase/auth";
import toast from "react-hot-toast";
import { auth } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { friendly, socialSignIn } from "./authShared";

export default function Register() {
  const nav = useNavigate();
    const { user, loading } = useAuth();
  useEffect(() => { if (!loading && user) nav("/dashboard", { replace: true }); }, [loading, user, nav]);
  const [f, setF] = useState({ name: "", email: "", password: "" }); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (f.password.length < 8) return toast.error("Use at least 8 characters.");
    setBusy(true);
    try {
      const c = await createUserWithEmailAndPassword(auth, f.email, f.password);
      await updateProfile(c.user, { displayName: f.name });
      await sendEmailVerification(c.user);
      toast.success("Account created. Check your inbox to verify your email.");
    } catch (err) { toast.error(friendly(err)); } setBusy(false);
  };
    const social = async (k) => { try { await socialSignIn(k); } catch (e) { toast.error(e.code === "link" ? e.message : friendly(e)); } };
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="glass w-full max-w-md p-8">
        <img src="/logo-icon.png" alt="SmartSpend" className="mb-4 h-14 w-14 object-contain" />
        <h1 className="text-2xl font-extrabold">Create your account</h1><p className="mb-6 text-sm text-slate-400">Start tracking in a minute</p>
        <form className="space-y-4" onSubmit={submit}>
          <div><label className="label">Full name</label><input className="input" required value={f.name} onChange={set("name")} /></div>
          <div><label className="label">Email</label><input className="input" type="email" required value={f.email} onChange={set("email")} /></div>
          <div><label className="label">Password</label><input className="input" type="password" required value={f.password} onChange={set("password")} /></div>
          <button className="btn w-full" disabled={busy}>Create account</button>
        </form>
        <div className="my-5 text-center text-xs text-slate-500">or</div>
        <div className="grid gap-2"><button className="btn-ghost" onClick={() => social("google")}>Sign up with Google</button><button className="btn-ghost" onClick={() => social("facebook")}>Sign up with Facebook</button></div>
        <p className="mt-6 text-center text-sm text-slate-400">Have an account? <Link className="text-mint" to="/login">Log in</Link></p>
      </div>
    </div>
  );
}
