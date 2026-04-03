// ── Firebase Init ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDYtTkAgBMakZHzu6_N0hjqd96ybjgLsZQ",
  authDomain: "universal-bet-1e63f.firebaseapp.com",
  databaseURL: "https://universal-bet-1e63f-default-rtdb.firebaseio.com",
  projectId: "universal-bet-1e63f",
  storageBucket: "universal-bet-1e63f.firebasestorage.app",
  messagingSenderId: "894518803826",
  appId: "1:894518803826:web:1ebe1f6fa1eb1d8e07b1eb",
  measurementId: "G-W02GC0KNR5"
};

firebase.initializeApp(firebaseConfig);
const db   = firebase.database();
const auth = firebase.auth();

// ── Global State ────────────────────────────────────────────────────────────
window.UB = {
  user: null,
  balance: 0,
  username: '',
  betHistory: [],
  liveBets: []
};

// ── Auth ─────────────────────────────────────────────────────────────────────
function showAuth(mode = 'login') {
  const overlay = document.getElementById('auth-overlay');
  overlay.classList.add('open');
  setAuthMode(mode);
}
function hideAuth() {
  document.getElementById('auth-overlay').classList.remove('open');
}

function setAuthMode(mode) {
  const title   = document.getElementById('auth-title');
  const sub     = document.getElementById('auth-sub');
  const nameWrap= document.getElementById('auth-name-wrap');
  const submit  = document.getElementById('auth-submit');
  const switchEl= document.getElementById('auth-switch');
  document.getElementById('auth-error').textContent = '';

  if (mode === 'login') {
    title.textContent  = 'Welcome back';
    sub.textContent    = 'Sign in to your account';
    nameWrap.style.display = 'none';
    submit.textContent = 'Sign In';
    switchEl.innerHTML = `No account? <a onclick="setAuthMode('register')">Register</a>`;
  } else {
    title.textContent  = 'Create account';
    sub.textContent    = 'Join Universal Bets';
    nameWrap.style.display = 'block';
    submit.textContent = 'Create Account';
    switchEl.innerHTML = `Already have one? <a onclick="setAuthMode('login')">Sign in</a>`;
  }
  document.getElementById('auth-mode').value = mode;
}

async function handleAuthSubmit() {
  const mode  = document.getElementById('auth-mode').value;
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-password').value;
  const name  = document.getElementById('auth-name').value.trim();
  const err   = document.getElementById('auth-error');

  if (!email || !pass) { err.textContent = 'Please fill in all fields.'; return; }

  try {
    if (mode === 'login') {
      await auth.signInWithEmailAndPassword(email, pass);
    } else {
      if (!name) { err.textContent = 'Username required.'; return; }
      const cred = await auth.createUserWithEmailAndPassword(email, pass);
      await db.ref(`users/${cred.user.uid}`).set({
        username: name,
        balance: 50,
        createdAt: Date.now(),
        totalBets: 0,
        totalWon: 0,
        totalLost: 0
      });
    }
    hideAuth();
  } catch(e) {
    err.textContent = e.message.replace('Firebase: ','').replace(/\(.*\)/,'');
  }
}

// ── Auth State ───────────────────────────────────────────────────────────────
auth.onAuthStateChanged(async user => {
  const navRight = document.getElementById('nav-right');

  if (user) {
    UB.user = user;
    const snap = await db.ref(`users/${user.uid}`).once('value');
    const data = snap.val() || {};
    UB.username = data.username || user.email.split('@')[0];
    UB.balance  = data.balance  || 0;

    renderNavLoggedIn();
    listenBalance();
    updateProfilePage();

    // Nav profile
    document.getElementById('nav-user').textContent = UB.username;
    document.getElementById('nav-avatar').textContent = UB.username[0].toUpperCase();

  } else {
    UB.user = null; UB.balance = 0; UB.username = '';
    renderNavLoggedOut();
  }
});

function renderNavLoggedIn() {
  document.getElementById('nav-auth-btns').style.display = 'none';
  document.getElementById('nav-user-area').style.display = 'flex';
  document.getElementById('balance-display').style.display = 'flex';
}
function renderNavLoggedOut() {
  document.getElementById('nav-auth-btns').style.display = 'flex';
  document.getElementById('nav-user-area').style.display = 'none';
  document.getElementById('balance-display').style.display = 'none';
}

function listenBalance() {
  if (!UB.user) return;
  db.ref(`users/${UB.user.uid}/balance`).on('value', snap => {
    UB.balance = snap.val() || 0;
    document.getElementById('bal-amount').textContent = '$' + UB.balance.toFixed(2);
  });
}

async function updateBalance(delta, game, betAmt, multiplier) {
  if (!UB.user) return false;
  const ref  = db.ref(`users/${UB.user.uid}`);
  const snap = await ref.once('value');
  const data = snap.val() || {};
  const newBal = Math.max(0, (data.balance || 0) + delta);

  const betEntry = {
    game, bet: betAmt, mult: multiplier.toFixed(2),
    pnl: delta, ts: Date.now(),
    result: delta >= 0 ? 'win' : 'loss'
  };

  const updates = {
    balance: newBal,
    totalBets: (data.totalBets || 0) + 1,
    totalWon:  (data.totalWon  || 0) + Math.max(0, delta),
    totalLost: (data.totalLost || 0) + Math.abs(Math.min(0, delta))
  };

  await ref.update(updates);
  await db.ref(`users/${UB.user.uid}/bets`).push(betEntry);

  // Push to global live feed
  await db.ref('liveBets').push({
    user: UB.username,
    game, bet: betAmt,
    mult: multiplier.toFixed(2),
    pnl: delta,
    ts: Date.now()
  }).then(() => {
    db.ref('liveBets').once('value', s => {
      const all = [];
      s.forEach(c => all.push({ key: c.key, ...c.val() }));
      if (all.length > 50) {
        db.ref('liveBets/' + all[0].key).remove();
      }
    });
  });

  return newBal;
}

function signOut() {
  auth.signOut();
}

// ── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ── Profanity filter (basic) ─────────────────────────────────────────────────
const BANNED = ['fuck','shit','ass','bitch','dick','cunt','nigger','faggot'];
function filterMsg(msg) {
  let m = msg;
  BANNED.forEach(w => {
    const re = new RegExp(w, 'gi');
    m = m.replace(re, '*'.repeat(w.length));
  });
  return m;
}

// ── Chat ─────────────────────────────────────────────────────────────────────
function initChat() {
  db.ref('chat').limitToLast(50).on('child_added', snap => {
    const { user, msg, ts, isAdmin } = snap.val();
    addChatMsg(user, msg, isAdmin);
  });
}

function addChatMsg(user, msg, isAdmin) {
  const el = document.getElementById('chat-messages');
  const d  = document.createElement('div');
  d.className = 'chat-msg';
  d.innerHTML = `<span class="cm-user${isAdmin?' admin':''}">${escHtml(user)}</span><span class="cm-text">${escHtml(msg)}</span>`;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
}

function sendChatMsg() {
  if (!UB.user) { showToast('Sign in to chat', 'info'); return; }
  const input = document.getElementById('chat-input');
  const raw   = input.value.trim();
  if (!raw || raw.length > 200) return;
  const msg = filterMsg(raw);
  db.ref('chat').push({ user: UB.username, msg, ts: Date.now(), isAdmin: false });
  input.value = '';
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Live Bets Feed ───────────────────────────────────────────────────────────
function initLiveFeed() {
  db.ref('liveBets').limitToLast(20).on('value', snap => {
    const bets = [];
    snap.forEach(c => bets.push(c.val()));
    renderLiveBets(bets.reverse());
  });
}

function renderLiveBets(bets) {
  const tbody = document.getElementById('live-bets-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  bets.forEach(b => {
    const win = b.pnl >= 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="user-cell">${escHtml(b.user)}</td>
      <td><span class="game-pill">${escHtml(b.game)}</span></td>
      <td>$${Number(b.bet).toFixed(2)}</td>
      <td>${b.mult}×</td>
      <td class="${win?'win':'loss'}">${win?'+':''}$${Math.abs(b.pnl).toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── User bet history ─────────────────────────────────────────────────────────
async function loadBetHistory() {
  if (!UB.user) return;
  const snap = await db.ref(`users/${UB.user.uid}/bets`).limitToLast(30).once('value');
  const bets = [];
  snap.forEach(c => bets.push(c.val()));
  bets.reverse();

  const tbody = document.getElementById('history-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  bets.forEach(b => {
    const win = b.pnl >= 0;
    const tr = document.createElement('tr');
    const d = new Date(b.ts);
    tr.innerHTML = `
      <td>${d.toLocaleDateString()} ${d.toLocaleTimeString()}</td>
      <td><span class="game-pill">${escHtml(b.game)}</span></td>
      <td>$${Number(b.bet).toFixed(2)}</td>
      <td>${b.mult}×</td>
      <td class="${win?'win':'loss'}">${win?'+':''}$${Math.abs(b.pnl).toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function updateProfilePage() {
  if (!UB.user) return;
  const el = document.getElementById('profile-username');
  if (el) el.textContent = UB.username;
  const av = document.getElementById('profile-avatar');
  if (av) av.textContent = UB.username[0]?.toUpperCase() || '?';
}
