import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import toast from "react-hot-toast";
import { auth } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { friendly, socialSignIn } from "./authShared";

export default function Login() {
  const nav = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false);

  // One page for everyone: once the profile has loaded, the admin claim decides where you land.
  useEffect(() => {
    if (!loading && user) nav(isAdmin ? "/admin/users" : "/dashboard", { replace: true });
  }, [loading, user, isAdmin, nav]);

  const go = async (fn) => { setBusy(true); try { await fn(); } catch (e) { toast.error(e.code === "link" ? e.message : friendly(e)); setBusy(false); } };
  const reset = async () => { if (!email) return toast.error("Enter your email first."); try { await sendPasswordResetEmail(auth, email); toast.success("Password reset email sent."); } catch (e) { toast.error(friendly(e)); } };
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="glass w-full max-w-md p-8">
        <h1 className="text-2xl font-extrabold">Welcome back</h1><p className="mb-6 text-sm text-slate-400">Log in to SmartSpend</p>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); go(() => signInWithEmailAndPassword(auth, email, password)); }}>
          <div><label className="label">Email</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="label">Password</label><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <button className="btn w-full" disabled={busy}>Log in</button>
        </form>
        <button onClick={reset} className="mt-3 text-sm text-mint hover:underline">Forgot password?</button>
        <div className="my-5 text-center text-xs text-slate-500">or</div>
        <div className="grid gap-2">
          <button className="btn-ghost" disabled={busy} onClick={() => go(() => socialSignIn("google"))}>Continue with Google</button>
          <button className="btn-ghost" disabled={busy} onClick={() => go(() => socialSignIn("facebook"))}>Continue with Facebook</button>
        </div>
        <p className="mt-6 text-center text-sm text-slate-400">New here? <Link className="text-mint" to="/register">Create an account</Link></p>
      </div>
    </div>
  );
}