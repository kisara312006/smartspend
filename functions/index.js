const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();

// Server-side admin check: reads the verified token, not anything the browser claims.
function requireAdmin(req) {
  if (!req.auth || req.auth.token.admin !== true) throw new HttpsError("permission-denied", "Admins only.");
}
async function audit(req, action, target, summary) {
  await admin.firestore().collection("auditLogs").add({
    adminUid: req.auth.uid, action, target, summary,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

exports.adminListUsers = onCall(async (req) => {
  requireAdmin(req);
  const res = await admin.auth().listUsers(200);
  return res.users.map(u => ({
    uid: u.uid, email: u.email, name: u.displayName || "", disabled: u.disabled,
    verified: u.emailVerified, created: u.metadata.creationTime,
    isAdmin: u.customClaims?.admin === true,
  }));
});

exports.adminSetDisabled = onCall(async (req) => {
  requireAdmin(req);
  const { uid, disabled } = req.data;
  if (uid === req.auth.uid) throw new HttpsError("invalid-argument", "You cannot disable yourself.");
  await admin.auth().updateUser(uid, { disabled: !!disabled });
  await audit(req, disabled ? "disable_user" : "enable_user", uid, "");
  return { ok: true };
});

exports.adminDeleteUser = onCall(async (req) => {
  requireAdmin(req);
  const { uid } = req.data;
  if (uid === req.auth.uid) throw new HttpsError("invalid-argument", "You cannot delete yourself.");
  await admin.auth().deleteUser(uid);
  const db = admin.firestore();
  const snap = await db.collection("expenses").where("userId", "==", uid).get();
  const batch = db.batch(); snap.forEach(d => batch.delete(d.ref));
  batch.delete(db.doc(`users/${uid}`)); await batch.commit();
  await audit(req, "delete_user", uid, `deleted ${snap.size} expenses`);
  return { ok: true };
});
