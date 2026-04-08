// Firemed — app.js
const SUPABASE_URL = 'https://odydlckpnygxgwrewvcw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keWRsY2tucHlneGd3cmV3dmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwNjI0NTYsImV4cCI6MjA1OTYzODQ1Nn0.eyJpc3MiOiJzdXBhYmFzZSJ9';

async function handleGoogleAuth() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://fire-med.vercel.app' }
  });
  if (error) showAuthError(error.message);
}
let currentMode = 'image';
let selectedStyle = 'realistic';
let selectedImageBase64 = null;
let pollingInterval = null;
let currentUser = null;
let currentSession = null;
let userCredits = 0;

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

  if (!email || !password) {
    showAuthError('Please enter email and password.');
    return;
  }

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

    if (data.error) {
      showAuthError(data.error);
      return;
    }

    if (tab === 'signup') {
      showAuthError('Account created! Please sign in.');
      switchAuthTab('login');
      return;
    }

    currentUser = data.user;
    currentSession = data.session;
    await loadProfile();
    showApp();

  } catch (err) {
    showAuthError('Something went wrong. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = tab === 'login' ? 'SIGN IN' : 'SIGN UP';
  }
}

async function loadProfile() {
  try {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.access_token}`
      },
      body: JSON.stringify({ action: 'getProfile' })
    });
    const data = await response.json();
    if (data.profile) {
      userCredits = data.profile.credits || 0;
      document.getElementById('creditsDisplay').textContent = userCredits;
    }
  } catch (err) {
    console.error('Profile load error:', err);
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
  document.getElementById('uploadSection').style.display = mode === 'image' ? 'block' : 'none';
  document.getElementById('descSection').style.display   = mode === 'image' ? 'block' : 'none';
  document.getElementById('textSection').style.display   = mode === 'text'  ? 'block' : 'none';
  document.getElementById('styleStepNum').textContent    = mode === 'image' ? '3' : '2';
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

// ---- Style selection ----
function selectStyle(btn, style) {
  document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
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
    nature:    'nature documentary style, peaceful natural environment'
  };
  return `${userPrompt}. Style: ${styleMap[style] || styleMap.realistic}.`;
}

// ---- Main generate ----
async function generateVideo() {
  hideError();

  if (userCredits <= 0) {
    showError('You have no credits left. Please purchase more credits.');
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
        imageBase64: selectedImageBase64
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || 'Something went wrong.');
    }

    pollResult(data.id);

  } catch (err) {
    showError(err.message || 'Could not generate video. Please try again.');
    hideResult();
    setLoading(false);
  }
}

// ---- Polling ----
async function pollResult(taskId) {
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
        body: JSON.stringify({ taskId })
      });

      const result = await response.json();

      if (result.status === 'succeeded' && result.output) {
        clearInterval(pollingInterval);
        setLoading(false);
        userCredits--;
        document.getElementById('creditsDisplay').textContent = userCredits;
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
  btn.textContent = on ? 'GENERATING...' : 'GENERATE VIDEO';
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
