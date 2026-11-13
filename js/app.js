
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  runTransaction,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { firebaseConfig, ADMIN_UID } from "./firebase-config.js";

const $ = id => document.getElementById(id);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


const tierPoints = {
  HT1: 1000,
  LT1: 900,
  HT2: 800,
  LT2: 700,
  HT3: 600,
  LT3: 500,
  HT4: 400,
  LT4: 300,
  HT5: 200,
  LT5: 100
};


let authMode = "register";
let activeList = "premium";
let currentUser = null;
let currentUsername = null;

const cleanUsername = value => value.trim().toLowerCase();

const syntheticEmail = username =>
  `${cleanUsername(username)}@holefight-tierlist.com`;

const isConfigured = () =>
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  !firebaseConfig.apiKey.includes("PASTE_") &&
  !firebaseConfig.projectId.includes("PASTE_");

function showMessage(id, message, success = false) {
  const el = $(id);
  if (!el) return;

  el.textContent = message;
  el.classList.toggle("success", success);
}

function toast(message) {
  const el = $("toast");
  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  setTimeout(() => el.classList.remove("show"), 2600);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function initials(name) {
  return (name || "?").slice(0, 2).toUpperCase();
}

function skinAvatar(name, fullBody = false) {
  const safeName = encodeURIComponent(name);

  const imageUrl = fullBody
    ? `https://mc-heads.net/body/${safeName}/100`
    : `https://mc-heads.net/avatar/${safeName}/64`;

  const fallbackUrl = fullBody
    ? "https://mc-heads.net/body/MHF_Steve/100"
    : "https://mc-heads.net/avatar/MHF_Steve/64";

  return `
    <img
      src="${imageUrl}"
      alt="${escapeHtml(name)}"
      loading="lazy"
      onerror="this.onerror=null;this.src='${fallbackUrl}'"
    >
  `;
}

function addDiscordButton() {
  if (document.getElementById("holeFightDiscord")) return;

  const button = document.createElement("a");

  button.id = "holeFightDiscord";
  button.href = "https://discord.gg/bWtAQndZY9";
  button.target = "_blank";
  button.rel = "noopener noreferrer";
  button.textContent = "JOIN DISCORD ↗";

  button.style.cssText = `
    position:fixed;
    right:22px;
    bottom:22px;
    z-index:9999;
    padding:14px 20px;
    border-radius:12px;
    background:#5865F2;
    color:white;
    font-weight:800;
    font-size:13px;
    letter-spacing:1px;
    text-decoration:none;
    box-shadow:0 8px 25px rgba(88,101,242,.35);
    transition:transform .2s,background .2s;
  `;

  button.addEventListener("mouseenter", () => {
    button.style.transform = "translateY(-3px)";
    button.style.background = "#4752C4";
  });

  button.addEventListener("mouseleave", () => {
    button.style.transform = "translateY(0)";
    button.style.background = "#5865F2";
  });

  document.body.appendChild(button);
}

function setAuthMode(mode) {
  authMode = mode;

  $("authTitle").textContent =
    mode === "register" ? "CREATE ACCOUNT" : "WELCOME BACK";

  $("authSubtitle").textContent =
    mode === "register"
      ? "Choose a unique username and password."
      : "Login with your Hole Fight account.";

  $("authSubmit").textContent =
    mode === "register" ? "Create account" : "Login";

  $("authModeSwitch").textContent =
    mode === "register"
      ? "Already have an account? Login"
      : "Don't have an account? Register";

  $("authMessage").textContent = "";
  $("authPassword").value = "";
}

function openAuth(mode) {
  setAuthMode(mode);
  $("authModal").classList.remove("hidden");
}

function closeAuth() {
  $("authModal").classList.add("hidden");
}

function showTier(player) {
  return `
    <div class="player-row">
      <div class="rank-number">#${player.rank}</div>

      <div class="player-identity">
        <div class="avatar">
          ${skinAvatar(player.username)}
        </div>
        <span>${escapeHtml(player.username)}</span>
      </div>

      <span class="tier-pill">${escapeHtml(player.tier)}</span>
      <span class="points">${player.points} pts</span>
    </div>
  `;
}

async function loadLeaderboard(list = activeList) {
  activeList = list;

  document.querySelectorAll(".switch-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.list === list);
  });

  $("podium").innerHTML =
    '<div class="empty-state">Loading player rankings...</div>';

  $("playerList").innerHTML = "";

  if (!isConfigured()) {
    $("podium").innerHTML =
      '<div class="empty-state">Connect Firebase to display live rankings.</div>';
    return;
  }

  try {
    const q = query(
      collection(db, "players"),
      where("list", "==", list)
    );

    const snap = await getDocs(q);

    const players = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    players.sort((a, b) =>
      (Number(b.points) - Number(a.points)) ||
      a.username.localeCompare(b.username)
    );

    players.forEach((player, index) => {
      player.rank = index + 1;
    });

    if (!players.length) {
      $("podium").innerHTML =
        '<div class="empty-state">No ranked players yet. Be the first!</div>';

      $("playerList").innerHTML = "";
      return;
    }

    const podiumOrder = [
      players[1],
      players[0],
      players[2]
    ].filter(Boolean);

    const classes = {
      1: "second",
      2: "first",
      3: "third"
    };

    $("podium").innerHTML = podiumOrder.map(player => {
      const cls = classes[player.rank] || "";

      return `
        <article class="podium-card ${cls}">
          <div class="podium-rank">${player.rank}</div>

          <div class="avatar podium-skin">
            ${skinAvatar(player.username, true)}
          </div>

          <div class="podium-name">
            ${escapeHtml(player.username)}
          </div>

          <span class="podium-tier">
            ${escapeHtml(player.tier)}
          </span>

          <div class="podium-points">
            ${player.points} POINTS
          </div>
        </article>
      `;
    }).join("");

    $("playerList").innerHTML = players.map(showTier).join("");

  } catch (error) {
    console.error("Leaderboard error:", error);

    $("podium").innerHTML =
      '<div class="empty-state">Could not load rankings. Check Firestore rules.</div>';
  }
}

$("year").textContent = new Date().getFullYear();

$("loginOpen").addEventListener("click", () => openAuth("login"));
$("registerOpen").addEventListener("click", () => openAuth("register"));
$("authClose").addEventListener("click", closeAuth);

$("authModal").addEventListener("click", e => {
  if (e.target === $("authModal")) closeAuth();
});

$("authModeSwitch").addEventListener("click", () => {
  setAuthMode(authMode === "register" ? "login" : "register");
});

document.querySelectorAll(".switch-btn").forEach(button => {
  button.addEventListener("click", () => {
    loadLeaderboard(button.dataset.list);
  });
});

$("authForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (!isConfigured()) {
    showMessage("authMessage", "Firebase is not configured yet.");
    return;
  }

  const username = $("authUsername").value.trim();
  const lower = cleanUsername(username);
  const password = $("authPassword").value;

  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
    showMessage(
      "authMessage",
      "Use 3-16 letters, numbers or underscores."
    );
    return;
  }

  if (password.length < 8) {
    showMessage("authMessage", "Use at least 8 characters.");
    return;
  }

  $("authSubmit").disabled = true;

  try {
    if (authMode === "register") {
      const usernameRef = doc(db, "usernames", lower);

      const credential = await createUserWithEmailAndPassword(
        auth,
        syntheticEmail(username),
        password
      );

      try {
        await runTransaction(db, async tx => {
          const reserved = await tx.get(usernameRef);

          if (reserved.exists()) {
            throw new Error("USERNAME_TAKEN");
          }

          tx.set(usernameRef, {
            uid: credential.user.uid,
            username
          });

          tx.set(doc(db, "users", credential.user.uid), {
            username,
            usernameLower: lower,
            createdAt: serverTimestamp()
          });
        });

        showMessage(
          "authMessage",
          "Account created successfully.",
          true
        );

        closeAuth();

      } catch (error) {
        await signOut(auth);
        await credential.user.delete();
        throw error;
      }

    } else {
      const credential = await signInWithEmailAndPassword(
        auth,
        syntheticEmail(username),
        password
      );

      const profile = await getDoc(
        doc(db, "users", credential.user.uid)
      );

      if (!profile.exists()) {
        await signOut(auth);
        throw new Error("Account profile is missing.");
      }

      closeAuth();
    }

  } catch (error) {
    let message = error.message || "Something went wrong.";

    if (error.message === "USERNAME_TAKEN") {
      message = "That username is already registered.";
    } else if (error.code === "auth/email-already-in-use") {
      message = "That username is already registered.";
    } else if (error.code === "auth/invalid-credential") {
      message = "Incorrect username or password.";
    } else if (error.code === "auth/weak-password") {
      message = "Use at least 8 characters.";
    } else if (error.code === "auth/too-many-requests") {
      message = "Too many attempts. Try again later.";
    }

    showMessage("authMessage", message);

  } finally {
    $("authSubmit").disabled = false;
  }
});

onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (user) {
    try {
      const profile = await getDoc(
        doc(db, "users", user.uid)
      );

      currentUsername = profile.exists()
        ? profile.data().username
        : null;

    } catch {
      currentUsername = null;
    }

    $("authActions").classList.add("hidden");
    $("userActions").classList.remove("hidden");

    $("signedInAs").textContent =
      currentUsername ? `@${currentUsername}` : "Signed in";

    $("adminOpen").classList.toggle(
      "hidden",
      user.uid !== ADMIN_UID || ADMIN_UID.includes("PASTE_")
    );

  } else {
    currentUsername = null;

    $("authActions").classList.remove("hidden");
    $("userActions").classList.add("hidden");
    $("adminOpen").classList.add("hidden");
  }
});

$("logoutBtn").addEventListener("click", () => {
  signOut(auth).catch(error => toast(error.message));
});

$("adminOpen").addEventListener("click", () => {
  $("adminModal").classList.remove("hidden");
});

$("adminClose").addEventListener("click", () => {
  $("adminModal").classList.add("hidden");
});

$("adminModal").addEventListener("click", e => {
  if (e.target === $("adminModal")) {
    $("adminModal").classList.add("hidden");
  }
});

$("tierForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (!currentUser || currentUser.uid !== ADMIN_UID) {
    showMessage("tierMessage", "Admin access required.");
    return;
  }

  const username = $("tierUsername").value.trim();
  const lower = cleanUsername(username);
  const list = $("tierList").value;
  const tier = $("tierValue").value;

  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
    showMessage("tierMessage", "Use a valid Minecraft username.");
    return;
  }

  if (!["premium", "cracked"].includes(list)) {
    showMessage("tierMessage", "Invalid leaderboard.");
    return;
  }

  if (!tierPoints[tier]) {
    showMessage("tierMessage", "Invalid tier.");
    return;
  }

  try {
    await setDoc(
      doc(db, "players", `${list}_${lower}`),
      {
        username,
        list,
        tier,
        points: tierPoints[tier],
        updatedAt: serverTimestamp()
      }
    );

    showMessage(
      "tierMessage",
      `${username} saved as ${tier}.`,
      true
    );

    $("tierUsername").value = "";

    await loadLeaderboard(activeList);

    toast("Player added successfully.");

  } catch (error) {
    console.error(error);

    showMessage(
      "tierMessage",
      error.message || "Could not save player."
    );
  }
});

$("removeForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (!currentUser || currentUser.uid !== ADMIN_UID) {
    showMessage("removeMessage", "Admin access required.");
    return;
  }

  const username = $("removeUsername").value.trim();
  const lower = cleanUsername(username);
  const list = $("removeList").value;

  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
    showMessage("removeMessage", "Enter a valid Minecraft username.");
    return;
  }

  try {
    await deleteDoc(
      doc(db, "players", `${list}_${lower}`)
    );

    showMessage(
      "removeMessage",
      "Player removed successfully.",
      true
    );

    $("removeUsername").value = "";

    await loadLeaderboard(activeList);

    toast("Player removed.");

  } catch (error) {
    console.error(error);

    showMessage(
      "removeMessage",
      error.message || "Could not remove player."
    );
  }
});

addDiscordButton();
loadLeaderboard("premium");
