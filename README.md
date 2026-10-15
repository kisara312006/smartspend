# SmartSpend: An AI Based Personal Expense Tracking and Spending Analyzer

Folders: `client/` (React + Vite + Tailwind), `functions/` (Firebase Cloud Functions), `scripts/makeAdmin.js`, and the Firebase rules files.

## 1. Run locally
1. Install Node.js 20 LTS (nodejs.org).
2. Firebase Console > create project "SmartSpend" > Add app (Web `</>`) > copy the config.
3. `cd client` then copy `../.env.example` to `client/.env` and paste the values.
4. `npm install` then `npm run dev` and open http://localhost:5173

## 2. Firebase setup
- Authentication > Sign-in method: enable Email/Password, Google, Facebook. For Facebook, create an app at developers.facebook.com, copy its App ID and App Secret into Firebase, and paste Firebase's "OAuth redirect URI" into Facebook Login > Valid OAuth Redirect URIs.
- Firestore Database > Create database > production mode > pick a region.
- Storage > Get started.
- `npm i -g firebase-tools`, `firebase login`, `firebase use --add` (pick your project).
- Deploy rules and indexes: `firebase deploy --only firestore,storage`
- Cloud Functions need the Blaze plan: `cd functions && npm install && cd ..` then `firebase deploy --only functions`

## 3. Create the admin (secure)
1. Register normally in the app with the email you want as admin.
2. Firebase Console > Project settings > Service accounts > Generate new private key. Save it as `serviceAccountKey.json` in the project root (git-ignored; NEVER upload it).
3. `cd functions && npm install && cd ..` then `node scripts/makeAdmin.js you@example.com`
4. Log out and log in again at /login. You will land on /admin/users.
Admin is a server-set custom claim, so editing Firestore or frontend code cannot grant it.

## 4. Push to GitHub
1. Install Git (git-scm.com). On github.com create a new empty repository (no README).
2. In the project root (the folder that contains `client/`):
```
git init
git add .
git status        # confirm .env and serviceAccountKey.json are NOT listed
git commit -m "Initial SmartSpend"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/smartspend.git
git push -u origin main
```
Later changes: `git add .`, `git commit -m "message"`, `git push`

## 5. Deploy on Netlify
1. app.netlify.com > Add new site > Import an existing project > GitHub > choose the repo.
2. `netlify.toml` already sets base `client`, build command `npm run build`, publish directory `dist`.
3. Site configuration > Environment variables: add all six `VITE_FIREBASE_*` values.
4. Deploy. Page refreshes work thanks to `client/public/_redirects`.
5. Firebase Console > Authentication > Settings > Authorized domains > add your `xxxx.netlify.app`.
6. Facebook app: add the domain under App Domains and switch the app to Live mode.
Netlify hosts only the frontend. Cloud Functions are deployed separately with `firebase deploy --only functions`.

## Troubleshooting
- auth/unauthorized-domain: add the domain under Authorized domains.
- "The query requires an index": click the link in the browser console, or `firebase deploy --only firestore:indexes`.
- Admin links missing after makeAdmin: log out and back in.
- Blank page on Netlify: env vars missing; add them and redeploy.
