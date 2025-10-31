/**
 * Supabase-backed portfolio editor (client-only)
 * - Public can READ content/projects
 * - Authenticated users can EDIT (email + password via Supabase Auth)
 *
 * 🔧 Fill in your Supabase URL and anon key below.
 * Create tables & policies with the provided SQL file in this zip.
 */
const SUPABASE_URL = "https://yuhxhdjgosxzsbgkwjys.supabase.co";   // <- change me
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1aHhoZGpnb3N4enNiZ2t3anlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NjM1NDIsImV4cCI6MjA3NzQzOTU0Mn0.XRLqowylYEkSy1Z-7ZSVZv2Mq0n5AA2zSVPjAkcLMfo";                 // <- change me
const STORAGE_BUCKET = "project-images";                   // <- create with public read

// Initialize client (using global from @supabase/supabase-js CDN)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const qs = (s, o=document)=>o.querySelector(s);
const qsa = (s, o=document)=>Array.from(o.querySelectorAll(s));

const state = {
  session: null,
  projects: []
};

function setStatus(text){ const e=qs('#authError'); if(e){ e.textContent = text || ''; } }
function setLoginLabel(){
  qs('#loginLabel').textContent = state.session ? 'Editing (Logout)' : 'Admin';
}

async function loadContent(){
  // content table has rows { key, value }
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

// Projects
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

function debounce(fn, delay){
  let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), delay); };
}

function toggleEditMode(on){
  const show = !!on;
  ['.edit-actions'].forEach(sel=>{
    qsa(sel).forEach(e=>e.classList.toggle('hidden', !show));
  });
  ['#heroTitle','#heroSubtitle','#aboutText'].forEach(sel=>{
    qs(sel).setAttribute('contenteditable', show ? 'true' : 'false');
  });
  setLoginLabel();
  renderProjects();
}

// Add project flow incl upload
function addProjectFlow(){
  const dlg = qs('#projectDialog');
  const form = qs('#projectForm');
  qs('#pTitle').value='';
  qs('#pDesc').value='';
  qs('#pLink').value='';
  qs('#pImg').value='';
  qs('#pImgFile').value='';
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

// Auth
async function signInFlow(){
  const email = qs('#emailInput').value.trim();
  const password = qs('#passwordInput').value;
  setStatus('');
  // try sign-in; if user not found, try sign-up
  const { data: siData, error: siErr } = await supabase.auth.signInWithPassword({ email, password });
  if(siErr){
    // try sign-up
    const { error: suErr } = await supabase.auth.signUp({ email, password });
    if(suErr){ setStatus(suErr.message); return; }
    setStatus('Account created. You are now signed in.');
  }
  const { data: sess } = await supabase.auth.getSession();
  state.session = sess.session;
  qs('#authDialog').close();
  toggleEditMode(true);
}

function bindEvents(){
  qs('#year').textContent = new Date().getFullYear();

  // Auth button
  qs('#loginBtn').addEventListener('click', async ()=>{
    if(state.session){
      // logout
      await supabase.auth.signOut();
      state.session = null;
      toggleEditMode(false);
      return;
    }
    setStatus('');
    qs('#authHint').textContent = "Sign in with your Supabase email & password. New? We'll create an account.";
    qs('#authDialog').showModal();
  });

  // Auth submit
  qs('#authForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    await signInFlow();
  });

  // Save buttons
  qs('#saveHero').addEventListener('click', saveContent);
  qs('#saveAbout').addEventListener('click', saveContent);
  qs('#saveProjects').addEventListener('click', async ()=>{
    // no-op: inline edits already auto-saved
    alert('Project changes are saved automatically.');
  });
  qs('#addProject').addEventListener('click', addProjectFlow);
}

async function bootstrap(){
  bindEvents();
  const { data: sess } = await supabase.auth.getSession();
  state.session = sess.session;
  toggleEditMode(!!state.session);
  await loadContent();
  await loadProjects();
}

document.addEventListener('DOMContentLoaded', bootstrap);