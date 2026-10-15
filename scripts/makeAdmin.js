// Run ONCE from your own computer to promote an existing account to admin.
// Usage: node scripts/makeAdmin.js admin@example.com
// Needs serviceAccountKey.json in the project root (git-ignored. NEVER commit it).
const admin = require("../functions/node_modules/firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("../serviceAccountKey.json")) });
(async () => {
  const user = await admin.auth().getUserByEmail(process.argv[2]);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  console.log("Admin claim set for", user.email, "- log out and in again to refresh the token.");
})();
