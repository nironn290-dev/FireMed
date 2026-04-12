// Firemed — app.js

const SUPABASE_URL = 'https://odydlckpnygxgwrewvcw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keWRsY2twbnlneGd3cmV3dmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Mzg1NzIsImV4cCI6MjA5MTIxNDU3Mn0.DwOAd5jKJsVHFCtGNmWOlIQULDEihkP6o4xxwnKvln0';

const CREDIT_COSTS = {
  'kling-v2-5-turbo-std': { '5': 4, '10': 7 },
  'kling-v2-5-turbo-pro': { '5': 6, '10': 10 },
  'kling-v2-6-pro':       { '5': 6, '10': 10 },
  'kling-v3-std':         { '5': 8, '10': 14 },
};

let currentMode = 'image';
let selectedStyle = 'realistic';
let selectedImageBase64 = null;
let selectedEndImageBase64 = null;
let selectedModel = 'kling-v2-5-turbo-std';
let selectedDuration = '5';
let pollingInterval = null;
let currentUser = null;
let currentSession = null;
let userCredits = 0;

async function getSupabase() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function handleGoogleAuth() {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://fire-med.vercel.app' }
  });
  if (error) showAuthError(error.message);
}

async function initAuth() {
  const supabase = await getSupabase();
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      currentUser = session.user;
      currentSession = session;
      
      // Gerçek krediyi Supabase'den çek
      try {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ action: 'getProfile' })
        });
        const data = await response.json();
        userCredits = data.profile?.credits ?? 0;
      } catch (err) {
        userCredits = 0;
      }
      
      document.getElementById('creditsDisplay').textContent = userCredits;
      showApp();
    }
  });
  await supabase.auth.getSession();
}

// ---- AUTH ----
function switchAuthTab(tab) {
  const loginBtn = document.querySelector('.auth-tab:first-child');
  const signupBtn = document.querySelector('.auth-tab:last-child');
  const authBtn = document.getElementById('authBtn');
  if (tab === 'login') {
    loginBtn.className = 'auth-tab active';
    signupBtn.className = 'auth-tab inactive';
    authBtn.textContent = 'SIGN IN';
  } else {
    loginBtn.className = 'auth-tab inactive';
    signupBtn.className = 'auth-tab active';
    authBtn.textContent = 'SIGN UP';
  }
  authBtn.dataset.tab = tab;
  document.getElementById('authError').style.display = 'none';
}

async function handleAuth() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  const tab = document.getElementById('authBtn').dataset.tab || 'login';
  if (!email || !password) { showAuthError('Please enter email and password.'); return; }
  const btn = document.getElementById('authBtn');
  btn.disabled = true;
  btn.textContent = 'Please wait...';
  try {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: tab, email, password })
    });
    const data = await response.json();
    if (data.error) { showAuthError(data.error); return; }
    if (tab === 'signup') { showAuthError('Account created! Please sign in.'); switchAuthTab('login'); return; }
    currentUser = data.user;
    currentSession = data.session;
    userCredits = 10;
    document.getElementById('creditsDisplay').textContent = userCredits;
    showApp();
  } catch (err) {
    showAuthError('Something went wrong. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = tab === 'login' ? 'SIGN IN' : 'SIGN UP';
  }
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.style.display = 'block';
}

function showApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'block';
}

function logout() {
  currentUser = null;
  currentSession = null;
  userCredits = 0;
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display = 'none';
  document.getElementById('authEmail').value = '';
  document.getElementById('authPassword').value = '';
}

// ---- Mode switch ----
function switchMode(mode) {
  currentMode = mode;
  document.getElementById('btnImage').className = mode === 'image' ? 'mode-btn active' : 'mode-btn inactive';
  document.getElementById('btnText').className  = mode === 'text'  ? 'mode-btn active' : 'mode-btn inactive';
  document.getElementById('btnAiImage').className = mode === 'aiimage' ? 'mode-btn active' : 'mode-btn inactive';

  document.getElementById('uploadSection').style.display = mode === 'image' ? 'block' : 'none';
  document.getElementById('descSection').style.display = mode === 'image' ? 'block' : 'none';
  document.getElementById('textSection').style.display = mode === 'text' ? 'block' : 'none';
  document.getElementById('aiImageSection').style.display = mode === 'aiimage' ? 'block' : 'none';
  document.getElementById('generateBtn').style.display = mode === 'aiimage' ? 'none' : 'block';

  // Model section ve mini butonları sadece aiimage'da gizle
  const modelSection = document.getElementById('model-kling-v2-5-turbo-std')?.closest('.section');
  if (modelSection) modelSection.style.display = mode === 'aiimage' ? 'none' : 'block';

  const miniBtnDiv = document.querySelector('div[style*="flex-wrap"]');
  if (miniBtnDiv) miniBtnDiv.style.display = mode === 'aiimage' ? 'none' : 'flex';

  const supportsEndFrame = selectedModel !== 'kling-v2-5-turbo-std';
  document.getElementById('endFrameSection').style.display = (mode === 'image' && supportsEndFrame) ? 'block' : 'none';

  hideError();
  hideResult();
}

// ---- File upload ----
function onFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    selectedImageBase64 = e.target.result.split(',')[1];
    const preview = document.getElementById('imagePreview');
    preview.src = e.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function onEndFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    selectedEndImageBase64 = e.target.result.split(',')[1];
    const preview = document.getElementById('endImagePreview');
    preview.src = e.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function selectModel(btn, model) {
  document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedModel = model;
  updateCreditDisplay();
  
  // Start/End frame sadece PRO ve V3'te çalışır
  const supportsEndFrame = model !== 'kling-v2-5-turbo-std';
  const endSection = document.getElementById('endFrameSection');
  endSection.style.display = (currentMode === 'image' && supportsEndFrame) ? 'block' : 'none';
  
  // STD seçilince end image'ı sıfırla
  if (!supportsEndFrame) {
    selectedEndImageBase64 = null;
    document.getElementById('endImagePreview').style.display = 'none';
  }
}

// ---- Duration selection ----
function selectDuration(btn, duration) {
  document.querySelectorAll('#dur-5, #dur-10').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedDuration = duration;
  updateCreditDisplay();
}

function updateCreditDisplay() {
  const cost = CREDIT_COSTS[selectedModel]?.[selectedDuration] || 4;
  document.getElementById('generateBtn').textContent = `GENERATE VIDEO (${cost} credits)`;
}

// ---- Style selection ----
function selectStyle(btn, style) {
  document.querySelectorAll('.mini-btn').forEach(b => b.classList.remove('active'));
  if (selectedDuration === '10') {
    document.getElementById('dur-10').classList.add('active');
  } else {
    document.getElementById('dur-5').classList.add('active');
  }
  btn.classList.add('active');
  selectedStyle = style;
}

// ---- Example prompts ----
function setTextPrompt(text) {
  document.getElementById('textPrompt').value = text;
}

// ---- Build prompt ----
function buildPrompt(userPrompt, style) {
  const styleMap = {
    realistic: 'photorealistic, high quality, natural lighting',
    cinematic: 'cinematic film style, dramatic lighting, movie quality',
    animation: 'smooth animation, vibrant colors, animated style',
    nature:    'nature documentary style, peaceful natural environment',
    lego:      'LEGO brick style, plastic toy aesthetic, colorful blocks',
    balloon:   'inflatable balloon style, puffy glossy surface, smooth rounded shapes',
    plush:     'plush toy style, soft fabric texture, cute stuffed animal aesthetic',
  };
  return `${userPrompt}. Style: ${styleMap[style] || styleMap.realistic}.`;
}

// ---- Main generate ----
async function generateVideo() {
  hideError();

  const cost = CREDIT_COSTS[selectedModel]?.[selectedDuration] || 4;

  if (userCredits < cost) {
    showError(`You need ${cost} credits for this video. You have ${userCredits} credits.`);
    return;
  }

  if (currentMode === 'image' && !selectedImageBase64) {
    showError('Please choose a photo first.');
    return;
  }
  if (currentMode === 'text') {
    const tp = document.getElementById('textPrompt').value.trim();
    if (!tp || tp.length < 5) {
      showError('Please describe what you want to see.');
      return;
    }
  }

  setLoading(true);
  showResultArea();

  try {
    let prompt;
    if (currentMode === 'image') {
      const desc = document.getElementById('prompt').value.trim();
      prompt = buildPrompt(desc || 'Animate this image with natural smooth motion', selectedStyle);
    } else {
      prompt = buildPrompt(document.getElementById('textPrompt').value.trim(), selectedStyle);
    }

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.access_token}`
      },
      body: JSON.stringify({
        prompt,
        mode: currentMode,
        imageBase64: selectedImageBase64,
        endImageBase64: selectedEndImageBase64,
        selectedModel,
        duration: selectedDuration
      })
    });

    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || 'Something went wrong.');
    pollResult(data.id, data.videoMode || currentMode, cost);

  } catch (err) {
    showError(err.message || 'Could not generate video. Please try again.');
    hideResult();
    setLoading(false);
  }
}

// ---- Polling ----
async function pollResult(taskId, videoMode, cost) {
  let attempts = 0;
  const maxAttempts = 120;

  pollingInterval = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      clearInterval(pollingInterval);
      showError('Video generation timed out. Please try again.');
      hideResult();
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`
        },
        body: JSON.stringify({ taskId, mode: videoMode })
      });

      const result = await response.json();

      if (result.status === 'succeeded' && result.output) {
        clearInterval(pollingInterval);
        setLoading(false);
        await deductCredits(cost);
        showVideo(result.output);
      } else if (result.status === 'failed') {
        clearInterval(pollingInterval);
        setLoading(false);
        showError('Video generation failed. Please try again.');
        hideResult();
      }

      const pct = Math.min(Math.round((attempts / maxAttempts) * 100), 95);
      document.getElementById('loadingPct').textContent = pct + '%';

    } catch (err) {
      clearInterval(pollingInterval);
      setLoading(false);
      showError('Connection error. Please try again.');
      hideResult();
    }
  }, 3000);
}

// ---- UI helpers ----
function setLoading(on) {
  const btn = document.getElementById('generateBtn');
  btn.disabled = on;
  const cost = CREDIT_COSTS[selectedModel]?.[selectedDuration] || 4;
  btn.textContent = on ? 'GENERATING...' : `GENERATE VIDEO (${cost} credits)`;
}

function showResultArea() {
  const area = document.getElementById('resultArea');
  area.style.display = 'block';
  document.getElementById('loadingAnim').style.display = 'flex';
  document.getElementById('resultVideo').style.display = 'none';
  document.getElementById('resultFooter').style.display = 'none';
  document.getElementById('statusBadge').className = 'status-badge status-loading';
  document.getElementById('statusBadge').textContent = 'Generating...';
  document.getElementById('loadingPct').textContent = '0%';
  area.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideResult() {
  document.getElementById('resultArea').style.display = 'none';
}

function showVideo(url) {
  const video = document.getElementById('resultVideo');
  video.src = url;
  video.style.display = 'block';
  document.getElementById('loadingAnim').style.display = 'none';
  document.getElementById('resultFooter').style.display = 'flex';
  document.getElementById('statusBadge').className = 'status-badge status-done';
  document.getElementById('statusBadge').textContent = 'Ready!';
  document.getElementById('loadingPct').textContent = '100%';
  document.getElementById('downloadBtn').onclick = () => {
    const a = document.createElement('a');
    a.href = url; a.download = 'firemed-video.mp4'; a.target = '_blank';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = '⚠ ' + msg;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
  document.getElementById('errorMsg').style.display = 'none';
}

function setAiImagePrompt(text) {
  document.getElementById('aiImagePrompt').value = text;
}

async function generateImage() {
  const prompt = document.getElementById('aiImagePrompt').value.trim();
  if (!prompt) {
    document.getElementById('aiImageError').textContent = 'Please describe your image.';
    document.getElementById('aiImageError').style.display = 'block';
    return;
  }
  document.getElementById('aiImageError').style.display = 'none';
  document.getElementById('aiImageLoading').style.display = 'block';
  document.getElementById('aiImageResult').style.display = 'none';
  try {
    const response = await fetch('/api/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.access_token}`
      },
      body: JSON.stringify({ prompt })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    const predictionId = data.predictionId;
    let attempts = 0;
    const maxAttempts = 150;
    const pollInterval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(pollInterval);
        document.getElementById('aiImageLoading').style.display = 'none';
        document.getElementById('aiImageError').textContent = '⚠ Timeout. Please try again.';
        document.getElementById('aiImageError').style.display = 'block';
        return;
      }
      try {
        const statusRes = await fetch('/api/image-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
  predictionId,
  userId: currentUser.id,
  prompt: prompt
})
        });
        const statusData = await statusRes.json();
        if (statusData.status === 'succeeded') {
          clearInterval(pollInterval);
          document.getElementById('aiImageOutput').src = statusData.imageUrl;
          document.getElementById('aiImageResult').style.display = 'block';
          document.getElementById('aiImageLoading').style.display = 'none';
          document.getElementById('aiImageDownloadBtn').onclick = () => {
            const a = document.createElement('a');
            a.href = statusData.imageUrl;
            a.download = 'firemed-image.png';
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          };
          userCredits -= 2;
          document.getElementById('creditsDisplay').textContent = userCredits;
        } else if (statusData.status === 'failed') {
          clearInterval(pollInterval);
          document.getElementById('aiImageLoading').style.display = 'none';
          document.getElementById('aiImageError').textContent = '⚠ Image generation failed. Please try again.';
          document.getElementById('aiImageError').style.display = 'block';
        }
      } catch (err) {}
    }, 2000);
  } catch (err) {
    document.getElementById('aiImageLoading').style.display = 'none';
    document.getElementById('aiImageError').textContent = '⚠ ' + (err.message || 'Something went wrong.');
    document.getElementById('aiImageError').style.display = 'block';
  }
}
async function deductCredits(amount) {
  try {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.access_token}`
      },
      body: JSON.stringify({ action: 'deductCredits', amount })
    });
    const data = await response.json();
    if (data.error) {
      showError('Insufficient credits!');
      return false;
    }
    userCredits = data.credits;
    document.getElementById('creditsDisplay').textContent = userCredits;
    return true;
  } catch (err) {
    console.error('Credit deduction error:', err);
    return false;
  }
}
let currentGalleryTab = 'image';

async function showGallery() {
  document.getElementById('appScreen').querySelector('main').style.display = 'none';
  document.getElementById('galleryScreen').style.display = 'block';

  // En son üretilen ne ise onu bul
  try {
    const response = await fetch('/api/gallery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.access_token}`
      },
      body: JSON.stringify({})  // type yok = hepsini getir
    });
    const data = await response.json();
    if (data.generations && data.generations.length > 0) {
      currentGalleryTab = data.generations[0].type; // en son üretilen
    }
  } catch(e) {}

  // Sekme butonlarını güncelle
  document.getElementById('galleryTabVideo').className = currentGalleryTab === 'video' ? 'mini-btn active' : 'mini-btn';
  document.getElementById('galleryTabImage').className = currentGalleryTab === 'image' ? 'mini-btn active' : 'mini-btn';

  loadGallery(currentGalleryTab);
}

function hideGallery() {
  document.getElementById('galleryScreen').style.display = 'none';
  document.getElementById('appScreen').querySelector('main').style.display = 'block';
}

function switchGalleryTab(tab) {
  currentGalleryTab = tab;
  document.getElementById('galleryTabVideo').className = tab === 'video' ? 'mini-btn active' : 'mini-btn';
  document.getElementById('galleryTabImage').className = tab === 'image' ? 'mini-btn active' : 'mini-btn';
  loadGallery(tab);
}

async function loadGallery(type) {
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = '<div style="text-align:center; color:var(--muted); padding:40px; grid-column:1/-1;">Loading...</div>';
  console.log('Loading gallery for type:', type);
  console.log('User session:', currentSession?.access_token ? 'OK' : 'NO SESSION');

  try {
    const response = await fetch('/api/gallery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.access_token}`
      },
      body: JSON.stringify({ type })
    });

    const data = await response.json();

    if (!data.generations || data.generations.length === 0) {
      grid.innerHTML = `<div style="text-align:center; color:var(--muted); padding:40px; grid-column:1/-1;">No ${type === 'video' ? 'videos' : 'images'} yet. Create your first one!</div>`;
      return;
    }

    grid.innerHTML = data.generations.map(item => `
      <div style="background:var(--surface); border-radius:12px; overflow:hidden; border:1px solid var(--border); cursor:pointer;">
        ${type === 'video'
          ? `<video src="${item.url}" style="width:100%; height:160px; object-fit:cover;" controls playsinline></video>`
          : `<img src="${item.url}" style="width:100%; height:auto; max-height:200px; object-fit:contain; display:block; background:#111;" onclick="openLightbox('${item.url}')" onerror="this.parentElement.style.display='none'" />`
        }
        <div style="padding:8px;">
          <div style="font-size:11px; color:var(--muted); margin-bottom:4px;">${new Date(item.created_at).toLocaleDateString()}</div>
          <div style="font-size:11px; color:#ccc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.prompt || ''}</div>
          <a href="${item.url}" target="_blank" style="display:block; text-align:center; background:var(--fire); color:#fff; border-radius:8px; padding:6px; font-size:12px; font-weight:700; margin-top:8px; text-decoration:none;">Download</a>
        </div>
      </div>
    `).join('');

  } catch (err) {
    grid.innerHTML = '<div style="text-align:center; color:#ff7777; padding:40px; grid-column:1/-1;">Error loading gallery.</div>';
  }
}
function openLightbox(url) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;';
  overlay.onclick = () => overlay.remove();
  const img = document.createElement('img');
  img.src = url;
  img.style.cssText = 'max-width:95%;max-height:95%;border-radius:12px;';
  overlay.appendChild(img);
  document.body.appendChild(overlay);
}
// Başlat
updateCreditDisplay();
document.getElementById('endFrameSection').style.display = 'none';
initAuth();
