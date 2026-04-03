// ── Page Router ──────────────────────────────────────────────────────────────
const PAGES = ['lobby','dice','crash','mines','plinko','limbo','chicken','profile','deposit','vip'];

function navigate(page, pushState = true) {
  PAGES.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.toggle('active', p === page);
  });

  // Sidebar active
  document.querySelectorAll('.sidebar-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === page);
  });

  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.page === page);
  });

  if (pushState) history.pushState({ page }, '', `#${page}`);

  // Lifecycle
  if (page === 'lobby')   initLobby();
  if (page === 'dice')    initDice();
  if (page === 'crash')   initCrash();
  if (page === 'mines')   initMines();
  if (page === 'plinko')  initPlinko();
  if (page === 'limbo')   initLimbo();
  if (page === 'chicken') initChicken();
  if (page === 'profile') { updateProfilePage(); loadBetHistory(); }
}

window.addEventListener('popstate', e => {
  if (e.state?.page) navigate(e.state.page, false);
});

// Hash routing on load
window.addEventListener('load', () => {
  const hash = location.hash.replace('#','') || 'lobby';
  const page = PAGES.includes(hash) ? hash : 'lobby';
  navigate(page, false);
  initChat();
  initLiveFeed();
});
