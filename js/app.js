import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, runTransaction, collection, getDocs,
  query, where, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig, ADMIN_UID } from "./firebase-config.js";

const $ = id => document.getElementById(id);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const tierPoints = {HT1:1000,HT2:900,HT3:800,HT4:700,HT5:600,LT1:500,LT2:400,LT3:300,LT4:200,LT5:100};
let authMode = "register";
let activeList = "premium";
let currentUser = null;
let currentUsername = null;

const cleanUsername = value => value.trim().toLowerCase();
const syntheticEmail = username => `${cleanUsername(username)}@holefight-tierlist.com`;
const showMessage = (id, message, success=false) => {
  const el = $(id); el.textContent = message; el.classList.toggle("success", success);
};
const toast = message => {
  const el=$("toast"); el.textContent=message; el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),2600);
};
const isConfigured = () => !firebaseConfig.apiKey.includes("PASTE_") && !firebaseConfig.projectId.includes("PASTE_");
const initials = name => (name || "?").slice(0,2).toUpperCase();

function setAuthMode(mode) {
  authMode=mode;
  $("authTitle").textContent=mode==="register"?"CREATE ACCOUNT":"WELCOME BACK";
  $("authSubtitle").textContent=mode==="register"?"Choose a unique username and password.":"Login with your Hole Fight account.";
  $("authSubmit").textContent=mode==="register"?"Create account":"Login";
  $("authModeSwitch").textContent=mode==="register"?"Already have an account? Login":"Don't have an account? Register";
  $("authMessage").textContent="";
  $("authPassword").value="";
}
function openAuth(mode) {
  setAuthMode(mode); $("authModal").classList.remove("hidden");
}
function closeAuth() {$("authModal").classList.add("hidden");}
function showTier(player) {
  return `<div class="player-row"><div class="rank-number">#${player.rank}</div><div class="player-identity"><div class="avatar">${initials(player.username)}</div><span>${escapeHtml(player.username)}</span></div><span class="tier-pill">${player.tier}</span><span class="points">${player.points} pts</span></div>`;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
async function loadLeaderboard(list=activeList) {
  activeList=list;
  document.querySelectorAll(".switch-btn").forEach(b=>b.classList.toggle("active",b.dataset.list===list));
  $("podium").innerHTML='<div class="empty-state">Loading player rankings...</div>';
  $("playerList").innerHTML="";
  if (!isConfigured()) {
    $("podium").innerHTML='<div class="empty-state">Connect Firebase to display live rankings. Follow SETUP.md.</div>';
    return;
  }
  try {
    const q=query(collection(db,"players"),where("list","==",list));
    const snap=await getDocs(q);
    const players=snap.docs.map(d=>({id:d.id,...d.data()}));
    players.sort((a,b)=>(b.points-a.points)||a.username.localeCompare(b.username));
    players.forEach((p,i)=>p.rank=i+1);
    if (!players.length) {
      $("podium").innerHTML='<div class="empty-state">No ranked players yet. Be the first to get tested!</div>';
      $("playerList").innerHTML="";
      return;
    }
    const podiumOrder=[players[1],players[0],players[2]].filter(Boolean);
    const classes={1:"second",2:"first",3:"third"};
    $("podium").innerHTML=podiumOrder.map(p=>{
      const cls=classes[p.rank]||"";
      return `<article class="podium-card ${cls}"><div class="podium-rank">${p.rank}</div><div class="avatar">${initials(p.username)}</div><div class="podium-name">${escapeHtml(p.username)}</div><span class="podium-tier">${p.tier}</span><div class="podium-points">${p.points} POINTS</div></article>`;
    }).join("");
    $("playerList").innerHTML=players.map(showTier).join("");
  } catch(error) {
    console.error(error);
    $("podium").innerHTML='<div class="empty-state">Could not load rankings. Check your Firebase setup and Firestore rules.</div>';
  }
}

$("year").textContent=new Date().getFullYear();
$("loginOpen").addEventListener("click",()=>openAuth("login"));
$("registerOpen").addEventListener("click",()=>openAuth("register"));
$("authClose").addEventListener("click",closeAuth);
$("authModal").addEventListener("click",e=>{if(e.target===$("authModal"))closeAuth();});
$("authModeSwitch").addEventListener("click",()=>setAuthMode(authMode==="register"?"login":"register"));
document.querySelectorAll(".switch-btn").forEach(b=>b.addEventListener("click",()=>loadLeaderboard(b.dataset.list)));

$("authForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!isConfigured()){showMessage("authMessage","Firebase is not configured yet. Follow SETUP.md.");return;}
  const username=$("authUsername").value.trim();
  const lower=cleanUsername(username);
  const password=$("authPassword").value;
  if(!/^[A-Za-z0-9_]{3,16}$/.test(username)){showMessage("authMessage","Use 3-16 letters, numbers or underscores.");return;}
  if(password.length<8){showMessage("authMessage","Password must have at least 8 characters.");return;}
  $("authSubmit").disabled=true;
  try {
    if(authMode==="register") {
      const usernameRef=doc(db,"usernames",lower);
      const credential=await createUserWithEmailAndPassword(auth,syntheticEmail(username),password);
      try {
        await runTransaction(db,async tx=>{
          const reserved=await tx.get(usernameRef);
          if(reserved.exists()) throw new Error("USERNAME_TAKEN");
          tx.set(usernameRef,{uid:credential.user.uid,username});
          tx.set(doc(db,"users",credential.user.uid),{username,usernameLower:lower,createdAt:serverTimestamp()});
        });
        showMessage("authMessage","Account created successfully.",true);
        closeAuth();
      } catch(err) {
        await signOut(auth);
        await credential.user.delete();
        throw err;
      }
    } else {
      const credential=await signInWithEmailAndPassword(auth,syntheticEmail(username),password);
      const profile=await getDoc(doc(db,"users",credential.user.uid));
      if(!profile.exists()) {await signOut(auth);throw new Error("Account profile is missing. Contact an administrator.");}
      closeAuth();
    }
  } catch(error) {
    let msg=error.message||"Something went wrong.";
    if(error.message==="USERNAME_TAKEN")msg="That username is already registered. Choose another one.";
    else if(error.code==="auth/email-already-in-use")msg="That username is already registered. Choose another one.";
    else if(error.code==="auth/invalid-credential")msg="Incorrect username or password.";
    else if(error.code==="auth/weak-password")msg="Password is too weak. Use at least 8 characters.";
    else if(error.code==="auth/too-many-requests")msg="Too many attempts. Try again later.";
    showMessage("authMessage",msg);
  } finally {$("authSubmit").disabled=false;}
});

onAuthStateChanged(auth,async user=>{
  currentUser=user;
  if(user) {
    try {
      const profile=await getDoc(doc(db,"users",user.uid));
      currentUsername=profile.exists()?profile.data().username:null;
    } catch {currentUsername=null;}
    $("authActions").classList.add("hidden");
    $("userActions").classList.remove("hidden");
    $("signedInAs").textContent=currentUsername?`@${currentUsername}`:"Signed in";
    $("adminOpen").classList.toggle("hidden",user.uid!==ADMIN_UID || ADMIN_UID.includes("PASTE_"));
  } else {
    currentUsername=null;
    $("authActions").classList.remove("hidden");
    $("userActions").classList.add("hidden");
    $("adminOpen").classList.add("hidden");
  }
});
$("logoutBtn").addEventListener("click",()=>signOut(auth).catch(e=>toast(e.message)));
$("adminOpen").addEventListener("click",()=>$("adminModal").classList.remove("hidden"));
$("adminClose").addEventListener("click",()=>$("adminModal").classList.add("hidden"));
$("adminModal").addEventListener("click",e=>{if(e.target===$("adminModal"))$("adminModal").classList.add("hidden");});

$("tierForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!currentUser||currentUser.uid!==ADMIN_UID){showMessage("tierMessage","Admin access required.");return;}
  const username=$("tierUsername").value.trim();
  const lower=cleanUsername(username);
  const list=$("tierList").value;
  const tier=$("tierValue").value;
  try {
    const reservation=await getDoc(doc(db,"usernames",lower));
    if(!reservation.exists()){showMessage("tierMessage","This player must register on the website first.");return;}
    const uid=reservation.data().uid;
    await setDoc(doc(db,"players",`${list}_${uid}`),{
      uid,username:reservation.data().username,list,tier,points:tierPoints[tier],updatedAt:serverTimestamp()
    });
    showMessage("tierMessage",`${username} saved as ${tier} in ${list}.`,true);
    $("tierUsername").value="";
    await loadLeaderboard(activeList);
    toast("Tier saved successfully.");
  } catch(error){showMessage("tierMessage",error.message||"Could not save tier.");}
});

$("removeForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!currentUser||currentUser.uid!==ADMIN_UID){showMessage("removeMessage","Admin access required.");return;}
  const lower=cleanUsername($("removeUsername").value);
  const list=$("removeList").value;
  try {
    const reservation=await getDoc(doc(db,"usernames",lower));
    if(!reservation.exists()){showMessage("removeMessage","Username not found.");return;}
    await deleteDoc(doc(db,"players",`${list}_${reservation.data().uid}`));
    showMessage("removeMessage","Player removed from this leaderboard.",true);
    $("removeUsername").value="";
    await loadLeaderboard(activeList);
  } catch(error){showMessage("removeMessage",error.message||"Could not remove player.");}
});

loadLeaderboard("premium");
