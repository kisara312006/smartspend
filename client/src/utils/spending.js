import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";

// Reads only this user's expenses between two "YYYY-MM-DD" dates (inclusive).
export async function fetchRange(uid, start, end) {
  const snap = await getDocs(query(collection(db, "expenses"),
    where("userId", "==", uid), where("date", ">=", start), where("date", "<=", end), orderBy("date", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export const sum = (rows) => rows.reduce((t, r) => t + r.amount, 0);