import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/config";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) { setUser(null); setProfile(null); setIsAdmin(false); setLoading(false); return; }
        setLoading(true);
    const token = await u.getIdTokenResult(true);       // role comes from server-set claim
    setIsAdmin(token.claims.admin === true);
    const ref = doc(db, "users", u.uid);
    let snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        name: u.displayName || "", email: u.email || "", photoURL: u.photoURL || "",
        provider: u.providerData[0]?.providerId || "password",
        currency: "LKR", monthlyBudget: 0, theme: "dark",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      snap = await getDoc(ref);
    }

        if (snap.data().suspended) {
      await signOut(auth);
      alert("This account has been suspended.");
      return;
    }
    setProfile({ id: u.uid, ...snap.data() });
    setUser(u); setLoading(false);
  }), []);

  const refreshProfile = async () => {
    const s = await getDoc(doc(db, "users", auth.currentUser.uid));
    setProfile({ id: s.id, ...s.data() });
  };
  return <Ctx.Provider value={{ user, profile, isAdmin, loading, refreshProfile, logout: () => signOut(auth) }}>{children}</Ctx.Provider>;
}
