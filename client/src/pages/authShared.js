import { GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, fetchSignInMethodsForEmail } from "firebase/auth";
import { auth } from "../firebase/config";

export function friendly(e) {
  const m = {
    "auth/invalid-credential": "Email or password is incorrect.", "auth/user-not-found": "No account with that email.",
    "auth/wrong-password": "Email or password is incorrect.", "auth/email-already-in-use": "That email is already registered. Try logging in.",
    "auth/weak-password": "Password must be at least 6 characters.", "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/cancelled-popup-request": "Sign-in was cancelled.", "auth/user-disabled": "This account has been suspended.",
    "auth/too-many-requests": "Too many attempts. Try again later.", "auth/network-request-failed": "Network error. Check your connection.",
    "auth/unauthorized-domain": "This domain isn't authorised in Firebase Authentication settings.",
  };
  return m[e.code] || "Something went wrong. Please try again.";
}

// Social sign-in; if the email already exists under another provider, tell the user how to proceed.
export async function socialSignIn(kind) {
  const provider = kind === "google" ? new GoogleAuthProvider() : new FacebookAuthProvider();
  try { return await signInWithPopup(auth, provider); }
  catch (e) {
    if (e.code === "auth/account-exists-with-different-credential") {
      const methods = await fetchSignInMethodsForEmail(auth, e.customData.email);
      throw Object.assign(new Error(`This email already uses ${methods.join(", ")}. Log in that way first.`), { code: "link" });
    }
    throw e;
  }
}
