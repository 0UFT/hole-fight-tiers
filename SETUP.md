# Hole Fight Tiers

A static website for GitHub Pages with Firebase Authentication and Cloud Firestore.

## Features
- Premium and Cracked leaderboards.
- Top 3 podium and full ranked player list.
- Username + password registration. Usernames are unique across both lists.
- Login and logout.
- Admin panel for the account `borscufasole`.
- Admin can assign HT1-HT5 and LT1-LT5, choose Premium or Cracked, and remove a player.
- Tier points determine leaderboard order:
  HT1 1000, HT2 900, HT3 800, HT4 700, HT5 600,
  LT1 500, LT2 400, LT3 300, LT4 200, LT5 100.

## Important architecture note
GitHub Pages is static hosting. It cannot securely store accounts, passwords or shared player rankings by itself.
Firebase Authentication handles accounts and Cloud Firestore stores the rankings.
The site uses Firebase Email/Password Authentication with an internal generated email based on the username. Players only enter a username and password. The generated address is not a mailbox.

## 1. Create Firebase project
1. Open https://console.firebase.google.com/
2. Create a project, for example `hole-fight-tiers`.
3. Open Authentication -> Get started -> Sign-in method.
4. Enable **Email/Password**.
5. Open Firestore Database -> Create database -> Start in production mode.
6. In Project settings -> General -> Your apps, create a Web app.
7. Copy the Firebase config values into `js/firebase-config.js`.

## 2. Create the admin account
Do this before making the website public.
1. Temporarily set up Firebase config in `js/firebase-config.js`.
2. Deploy the site privately or run it locally with a local web server.
3. Register the username `borscufasole` with a strong, unique password.
4. In Firebase Console -> Authentication -> Users, copy the UID for `borscufasole`.
5. Paste that UID into `ADMIN_UID` in `js/firebase-config.js`.
6. Paste the same UID into `firestore.rules`, replacing `PASTE_BORSCUFASOLE_AUTH_UID_HERE`.
7. Publish the Firestore rules from Firebase Console -> Firestore Database -> Rules.

**Do not publish the site before reserving the `borscufasole` account and setting the admin UID.**
The admin check is based on the Firebase UID, not the public username. This prevents another user from getting admin access just by choosing the same display name.

## 3. Publish Firestore rules
1. Open Firestore Database -> Rules.
2. Replace the default rules with the content of `firestore.rules`.
3. Replace the admin UID placeholder as described above.
4. Click Publish.

These rules let anyone read public rankings, allow a user to reserve their own unique username, and restrict tier changes to the configured admin UID.

## 4. Publish on GitHub Pages
1. Create a GitHub repository named `hole-fight-tiers`.
2. Upload all files and folders from this project. Keep `index.html` in the repository root.
3. Open repository Settings -> Pages.
4. Under Build and deployment choose **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then Save.
6. Wait for GitHub Pages to publish your website.

## 5. Firebase authorized domains
In Firebase Console -> Authentication -> Settings -> Authorized domains, add your GitHub Pages hostname, for example:
`YOUR-GITHUB-USERNAME.github.io`

## 6. How to use the admin panel
1. Log in with `borscufasole`.
2. Click Admin Panel in the top-right.
3. Enter the player's registered website username.
4. Select Premium or Cracked.
5. Select a tier from HT1 to LT5.
6. Click Save tier.

The player appears on the selected leaderboard after the page refreshes. Reassigning a tier updates their existing entry. A player can have separate entries on Premium and Cracked lists.

## Local preview
Because this project uses JavaScript modules, open it through a local web server rather than double-clicking `index.html`.
For example, with Python installed:
`python -m http.server 8000`
Then open `http://localhost:8000`.

## Security and limitations
- Never share the admin password or UID.
- Do not commit real passwords or private keys.
- Firebase web API config is designed to be public. Firestore Security Rules protect the data.
- The site does not verify whether a Minecraft account is actually premium or cracked. The admin chooses the leaderboard when assigning a tier.
- Username uniqueness is case-insensitive.
- This is an unofficial community project and is not affiliated with Mojang or Microsoft.
