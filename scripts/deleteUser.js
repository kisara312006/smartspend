// Usage: node scripts/deleteUser.js user@example.com
// Deletes the login account, the profile and all expenses of that user.
const admin = require("../functions/node_modules/firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("../serviceAccountKey.json")) });
(async () => {
  const user = await admin.auth().getUserByEmail(process.argv[2]);
  if (user.customClaims?.admin) { console.log("Refusing to delete an admin."); return; }
  const db = admin.firestore();
  const snap = await db.collection("expenses").where("userId", "==", user.uid).get();
  const batch = db.batch();
  snap.forEach(d => batch.delete(d.ref));
  batch.delete(db.doc(`users/${user.uid}`));
  await batch.commit();
  await admin.auth().deleteUser(user.uid);
  console.log(`Deleted ${user.email} and ${snap.size} expenses.`);
})();