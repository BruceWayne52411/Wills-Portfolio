// --- ADMIN HOTFIX: prove the click and open the dialog ---
console.log('[hotfix] script loaded');

(function () {
  function openAuthDialog() {
    const dlg = document.getElementById('authDialog');
    if (!dlg) { alert('[hotfix] #authDialog not in DOM'); return; }
    console.log('[hotfix] opening dialog');
    dlg.showModal();
  }

  // Global capture: fires even if other handlers stopPropagation
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('#loginBtn');
    if (btn) {
      console.log('[hotfix] CAPTURE click on #loginBtn via', e.target);
      e.preventDefault();
      openAuthDialog();
    }
  }, true);

  // After everything is loaded, also attach a direct listener
  window.addEventListener('load', () => {
    const btn = document.getElementById('loginBtn');
    console.log('[hotfix] window.load; loginBtn =', !!btn);
    if (btn) {
      btn.addEventListener('click', (e) => {
        console.log('[hotfix] DIRECT listener fired');
        e.preventDefault();
        openAuthDialog();
      });
    }
  });
})();

/**
 * Supabase-backed portfolio editor (client-only)
 * - Public can READ content/projects
 * - Authenticated (allowlisted) users can EDIT via Email OTP / Magic Link
 *
 * 🔧 Fill in your Supabase URL and anon key below.
 */
const SUPABASE_URL = "https://yuhxhdjgosxzsbgkwjys.supabase.co";   // <- change me (project URL)
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1aHhoZGpnb3N4enNiZ2t3anlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NjM1NDIsImV4cCI6MjA3NzQzOTU0Mn0.XRLqowylYEkSy1Z-7ZSVZv2Mq0n5AA2zSVPjAkcLMfo"; // <- change me (public anon key)
const STORAGE_BUCKET = "project-images"; // <- create with public read (or set storage policies)

// Initialize client (using global from @supabase/supabase-js CDN)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const qs = (s, o=document)=>o.querySelector(s);
const qsa = (s, o=document)=>Array.from(o.querySelectorAll(s));

const state = {
  session: null,
  projects: [],
  isAdmin: false,  // email is on allowlist
  editing: false   // UI edit mode on/off
};


function setStatus(text){ const e=qs('#authError'); if(e){ e.textContent = text || ''; } }
function setLoginLabel(){
  const lab = qs('#loginLabel');
  if (lab) lab.textContent = state.session ? 'Editing (Logout)' : 'Admin';
}

async function refreshAuthUI() {
  const { data: { session } } = await supabase.auth.getSession();
  state.session = session;

  let allowed = false;
  if (session) {
    const { data } = await supabase.rpc('is_allowlisted');
    allowed = !!data;
  }
  state.isAdmin = allowed;

  // If you’re no longer allowed, exit edit mode
  if (!state.isAdmin && state.editing) toggleEditMode(false);

  updateLoginButton();
}



/* =====================
   Public content (READ)
   ===================== */
async function loadContent(){
  const { data, error } = await supabase.from('content').select('*');
  if(error){ console.error(error); return; }
  const map = Object.fromEntries((data || []).map(r => [r.key, r.value]));
  qs('#heroTitle').textContent = map.heroTitle || "Hi, I'm Your Name";
  qs('#heroSubtitle').textContent = map.heroSubtitle || "Security Officer • Web Dev Student • PC Builder";
  qs('#aboutText').textContent = map.aboutText || "Write a short bio about yourself here. You can toggle Admin and edit this text.";
}

async function saveContent(){
  const rows = [
    { key:'heroTitle', value: qs('#heroTitle').textContent.trim() },
    { key:'heroSubtitle', value: qs('#heroSubtitle').textContent.trim() },
    { key:'aboutText', value: qs('#aboutText').textContent.trim() }
  ];
  const { error } = await supabase.from('content').upsert(rows, { onConflict: 'key' });
  if(error){ alert('Failed to save: ' + error.message); return; }
  alert('Saved content');
}

/* ================
   Projects (CRUD)
   ================ */
async function loadProjects(){
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if(error){ console.error(error); return; }
  state.projects = data || [];
  renderProjects();
}

function renderProjects(){
  const grid = qs('#projectsGrid');
  grid.innerHTML = '';
  const tpl = qs('#projectCardTpl');
  if(state.projects.length === 0){
    const p = document.createElement('p');
    p.textContent = 'No projects yet.';
    grid.appendChild(p);
    return;
  }
  state.projects.forEach((prj)=>{
    const node = tpl.content.firstElementChild.cloneNode(true);
    qs('.thumb', node).src = prj.image_url || '';
    qs('.thumb', node).alt = prj.title || 'Project';
    qs('.proj-title', node).textContent = prj.title || 'Untitled';
    qs('.proj-desc', node).textContent = prj.description || '';
    const link = qs('.proj-link', node);
    if(prj.link){ link.href = prj.link; } else { link.classList.add('hidden'); }

    const delBtn = qs('.removeProject', node);
    if(state.session){ delBtn.classList.remove('hidden'); }
    delBtn.addEventListener('click', async ()=>{
      if(!confirm('Delete this project?')) return;
      const { error } = await supabase.from('projects').delete().eq('id', prj.id);
      if(error){ alert('Failed to delete: ' + error.message); return; }
      await loadProjects();
    });

    // inline edit
    if(state.session){
      qsa('[contenteditable]', node).forEach(el=>el.setAttribute('contenteditable','true'));
      qs('.proj-title', node).addEventListener('input', debounce(async (e)=>{
        await supabase.from('projects').update({ title: e.target.textContent }).eq('id', prj.id);
      }, 400));
      qs('.proj-desc', node).addEventListener('input', debounce(async (e)=>{
        await supabase.from('projects').update({ description: e.target.textContent }).eq('id', prj.id);
      }, 400));
    }
    grid.appendChild(node);
  });
}

function updateLoginButton() {
  const el = qs('#loginLabel');
  if (!el) return;
  if (state.editing)        { el.textContent = 'Finish editing'; return; }
  if (state.isAdmin)        { el.textContent = 'Edit';           return; }
  if (state.session)        { el.textContent = 'Logout';         return; }
  el.textContent = 'Admin';
}


function debounce(fn, delay){
  let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), delay); };
}

function toggleEditMode(on){
  state.editing = !!on;
  qsa('.edit-actions').forEach(e=>e.classList.toggle('hidden', !state.editing));
  ['#heroTitle','#heroSubtitle','#aboutText'].forEach(sel=>{
    const el = qs(sel); if (el) el.setAttribute('contenteditable', state.editing ? 'true' : 'false');
  });
  updateLoginButton();
  renderProjects();
}


/* =============================
   Add project (includes upload)
   ============================= */
function addProjectFlow(){
  const dlg = qs('#projectDialog');
  const form = qs('#projectForm');
  qs('#pTitle').value=''; qs('#pDesc').value=''; qs('#pLink').value='';
  qs('#pImg').value=''; qs('#pImgFile').value='';
  dlg.showModal();
  form.onsubmit = async (e)=>{
    e.preventDefault();
    const title = qs('#pTitle').value.trim();
    if(!title) return;
    const desc = qs('#pDesc').value.trim();
    const link = qs('#pLink').value.trim();
    const file = qs('#pImgFile').files[0];
    let image_url = qs('#pImg').value.trim();

    if(file){
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false });
      if(upErr){ alert('Upload failed: ' + upErr.message); return; }
      const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      image_url = pub.publicUrl;
    }

    const { error } = await supabase.from('projects').insert({ title, description: desc, link, image_url });
    if(error){ alert('Failed to add project: ' + error.message); return; }
    dlg.close();
    await loadProjects();
  };
}

/* =========================
   AUTH — OTP / Magic Link
   ========================= */
async function sendOtp(){
  const email = qs('#emailInput').value.trim();
  if(!email) return setStatus('Enter your email');
  setStatus('Sending code...');

  // Invite-only: requires the user to exist already; set shouldCreateUser:false
  await supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname }
});


  if (error) return setStatus(error.message);

  // Show OTP UI
  setStatus('Check your email for a 6-digit code (or click the magic link).');
  qs('#otpRow')?.classList.remove('hidden');
  qs('#verifyOtpBtn')?.classList.remove('hidden');
  qs('#sendOtpBtn')?.classList.add('hidden');
}

async function verifyOtp(){
  const email = qs('#emailInput').value.trim();
  const token = qs('#otpInput').value.trim();
  if(!token) return setStatus('Enter the 6-digit code');

  setStatus('Verifying...');
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email' // 6-digit email code
  });

  if (error) return setStatus(error.message);

  const { data: sess } = await supabase.auth.getSession();
  state.session = sess.session;
  setStatus('');
  qs('#authDialog').close();
  toggleEditMode(true);
}

async function handleMagicLink() {
  const url = new URL(window.location.href);
  const hasHashToken = url.hash.includes('access_token') || url.hash.includes('refresh_token') || url.hash.includes('type=recovery');
  const hasPkce = url.searchParams.get('code') && url.searchParams.get('state');
  if (hasHashToken || hasPkce) {
    const { error } = await supabase.auth.exchangeCodeForSession(url.href);
    if (error) console.error('Magic link exchange failed:', error.message);
    history.replaceState({}, document.title, url.pathname);
  }
}

await refreshAuthUI();
qs('#authDialog').close();


// At any time:
const { data: { session } } = await supabase.auth.getSession();
console.log('signed in as:', session?.user?.email);

// And check your allowlist policy path:
const { data: allowed, error: allowErr } = await supabase.rpc('is_allowlisted');
console.log('is_allowlisted?', allowed, allowErr);


/* =========================
   Events / Bootstrap
   ========================= */
function bindEvents() {
  const year = qs('#year');
  if (year) year.textContent = new Date().getFullYear();

  // Admin button
  on('#loginBtn', 'click', async () => {
  // If currently editing → finish (don’t log out)
  if (state.editing) { toggleEditMode(false); return; }

  // If signed in
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    // If allow-listed → start editing
    if (state.isAdmin) { toggleEditMode(true); return; }
    // Not allow-listed → log out
    await supabase.auth.signOut();
    state.session = null;
    updateLoginButton();
    return;
  }

  // Not signed in → open OTP dialog
  const dlg = qs('#authDialog');
  if (!dlg) { alert('Auth dialog not found'); return; }
  setStatus('');
  qs('#authHint').textContent = "Enter your email and click ‘Send code’. Only invited/allowlisted emails can sign in.";
  qs('#otpRow')?.classList.add('hidden');
  qs('#verifyOtpBtn')?.classList.add('hidden');
  qs('#sendOtpBtn')?.classList.remove('hidden');
  qs('#emailInput') && (qs('#emailInput').value = '');
  qs('#otpInput')   && (qs('#otpInput').value   = '');
  dlg.showModal();
});


  // OTP actions
  on('#sendOtpBtn', 'click', sendOtp);
  on('#authForm', 'submit', async (e) => {
    e.preventDefault();
    await verifyOtp(); // after this verifyOtp will call refreshAuthUI()
  });

  // Save / project handlers
  on('#saveHero', 'click', saveContent);
  on('#saveAbout', 'click', saveContent);
  on('#saveProjects', 'click', () =>
    alert('Project changes are saved automatically.')
  );
  on('#addProject', 'click', addProjectFlow);
}

async function bootstrap(){
  bindEvents();

  // Exchange magic link (if coming from email)
  await handleMagicLink();

  // Get current session and set edit mode
  const { data: sess } = await supabase.auth.getSession();
  state.session = sess.session;
  toggleEditMode(!!state.session);

  // Load public data
  await loadContent();
  await loadProjects();
}

document.addEventListener('DOMContentLoaded', bootstrap);

// Show which project your JS is hitting
console.log(SUPABASE_URL);

// See what loadContent() gets
const { data, error } = await supabase.from('content').select('*');
console.log('content rows:', data, 'error:', error);

console.log('[boot] script.js loaded');

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('loginBtn');
  const dlg = document.getElementById('authDialog');
  console.log('[boot] DOM ready; loginBtn=', !!btn, 'authDialog=', !!dlg);

  if (!btn) { console.warn('No #loginBtn in DOM'); return; }

  // TEMP: minimal test handler
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('[admin] clicked');
    if (!dlg) { alert('Auth dialog not found'); return; }
    dlg.showModal(); // should open every time for this test
  });
});
