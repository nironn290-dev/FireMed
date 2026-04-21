// Firemed — app.js

const SUPABASE_URL = 'https://odydlckpnygxgwrewvcw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keWRsY2twbnlneGd3cmV3dmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Mzg1NzIsImV4cCI6MjA5MTIxNDU3Mn0.DwOAd5jKJsVHFCtGNmWOlIQULDEihkP6o4xxwnKvln0';

const CREDIT_COSTS = {
  'kling-v2-5-turbo-std': { '5': 6, '10': 11 },
  'kling-v2-5-turbo-pro': { '5': 11, '10': 18 },
  'kling-v2-6-std':       { '5': 6, '10': 11 },
  'kling-v2-6-pro':       { '5': 11, '10': 18 },
  'kling-v3-std':         { '5': 13, '10': 22 },
};

let currentMode = 'image';
let selectedStyle = 'realistic';
let enableAudio = false;
let enableVoice = false;
let selectedImageBase64 = null;
let selectedEndImageBase64 = null;
let selectedModel = 'kling-v2-5-turbo-std';
let selectedDuration = '5';
let selectedRatio = '16:9';
let selectedTextRatio = '16:9';
let selectedImageRatio = '1:1';
let pollingInterval = null;
let currentUser = null;
let currentSession = null;
let userCredits = 0;
let selectedMotionModel = 'kling-v2-6-pro';
let selectedMotionImageBase64 = null;
let selectedMotionVideoBase64 = null;
let selectedMotionVideoDuration = 5;

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
    if (tab === 'signup') { showAuthError('✅ Account created! Please check your email to verify your account before signing in.'); switchAuthTab('login'); return; }
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
  document.getElementById('galleryScreen').style.display = 'none';
  document.getElementById('profileScreen').style.display = 'none';
  document.getElementById('pricingScreen').style.display = 'none';
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
document.getElementById('btnMotion').className = mode === 'motion' ? 'mode-btn active' : 'mode-btn inactive';

  document.getElementById('uploadSection').style.display = mode === 'image' ? 'block' : 'none';
  document.getElementById('descSection').style.display = mode === 'image' ? 'block' : 'none';
  document.getElementById('textSection').style.display = mode === 'text' ? 'block' : 'none';
  document.getElementById('aiImageSection').style.display = mode === 'aiimage' ? 'block' : 'none';
document.getElementById('motionSection').style.display = mode === 'motion' ? 'block' : 'none';
  document.getElementById('generateBtn').style.display = (mode === 'aiimage' || mode === 'motion') ? 'none' : 'block';
  // Model section ve mini butonları sadece aiimage'da gizle
  const modelSection = document.getElementById('model-kling-v2-5-turbo-std')?.closest('.section');
if (modelSection) modelSection.style.display = (mode === 'aiimage' || mode === 'motion') ? 'none' : 'block';

  const miniBtnDiv = document.querySelector('div[style*="flex-wrap"]');
if (miniBtnDiv) miniBtnDiv.style.display = (mode === 'aiimage' || mode === 'motion') ? 'none' : 'flex';

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
    const wrapper = document.getElementById('imagePreviewWrapper');
    const uploadBox = document.querySelector('#uploadSection .upload-box');
    preview.src = e.target.result;
    wrapper.style.display = 'block';
    uploadBox.style.display = 'none';
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
    const wrapper = document.getElementById('endImagePreviewWrapper');
    const uploadBox = document.querySelector('#endFrameSection .upload-box');
    preview.src = e.target.result;
    preview.style.display = 'block';
    wrapper.style.display = 'block';
    uploadBox.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function clearStartImage() {
  selectedImageBase64 = null;
  const preview = document.getElementById('imagePreview');
  const wrapper = document.getElementById('imagePreviewWrapper');
  const uploadBox = document.querySelector('#uploadSection .upload-box');
  preview.src = '';
  wrapper.style.display = 'none';
  uploadBox.style.display = 'flex';
  document.getElementById('fileInput').value = '';
}

function clearEndImage() {
  selectedEndImageBase64 = null;
  const preview = document.getElementById('endImagePreview');
  const wrapper = document.getElementById('endImagePreviewWrapper');
  const uploadBox = document.querySelector('#endFrameSection .upload-box');
  preview.src = '';
  wrapper.style.display = 'none';
  uploadBox.style.display = 'flex';
  document.getElementById('endFileInput').value = '';
}

function selectMotionModel(btn, model) {
  document.querySelectorAll('#motion-model-v2-6-std, #motion-model-v2-6-pro, #motion-model-v3-std').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedMotionModel = model;
  if (selectedMotionVideoDuration) {
    const credits = calculateMotionCredits(selectedMotionVideoDuration);
    document.getElementById('motionGenerateBtn').textContent = `🎬 GENERATE MOTION VIDEO (${credits} credits • ${selectedMotionVideoDuration}s)`;
  }
}

function onMotionImageSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    selectedMotionImageBase64 = e.target.result.split(',')[1];
    document.getElementById('motionImagePreview').src = e.target.result;
    document.getElementById('motionImagePreviewWrapper').style.display = 'block';
    document.getElementById('motionImageBox').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function onMotionVideoSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 100 * 1024 * 1024) {
    showError('Reference video must be under 100MB.');
    return;
  }
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.onloadedmetadata = function() {
    URL.revokeObjectURL(video.src);
    const duration = Math.round(video.duration);
    if (duration < 5) {
      showError('⚠ Reference video must be at least 5 seconds long. Please upload a longer video.');
      return;
    }
    if (duration > 30) {
      showError('⚠ Reference video must be under 30 seconds.');
      return;
    }
    selectedMotionVideoDuration = duration;
    const credits = calculateMotionCredits(duration);
    document.getElementById('motionGenerateBtn').textContent = `🎬 GENERATE MOTION VIDEO (${credits} credits • ${duration}s)`;
    const reader = new FileReader();
    reader.onload = function(e) {
      selectedMotionVideoBase64 = e.target.result.split(',')[1];
      document.getElementById('motionVideoPreview').src = e.target.result;
      document.getElementById('motionVideoPreviewWrapper').style.display = 'block';
      document.getElementById('motionVideoBox').style.display = 'none';
    };
    reader.readAsDataURL(file);
  };
  video.src = URL.createObjectURL(file);
}

function calculateMotionCredits(duration) {
  const baseCredits = {
    'kling-v2-6-std': 11,
    'kling-v2-6-pro': 14,
    'kling-v3-std': 16
  };
  const perSecond = {
    'kling-v2-6-std': 2.2,
    'kling-v2-6-pro': 2.8,
    'kling-v3-std': 3.2
  };
  const base = baseCredits[selectedMotionModel] || 11;
  const extra = Math.max(0, duration - 5) * (perSecond[selectedMotionModel] || 2.2);
  return Math.ceil(base + extra);
}

function clearMotionImage() {
  selectedMotionImageBase64 = null;
  document.getElementById('motionImagePreview').src = '';
  document.getElementById('motionImagePreviewWrapper').style.display = 'none';
  document.getElementById('motionImageBox').style.display = 'flex';
  document.getElementById('motionImageInput').value = '';
}

function clearMotionVideo() {
  selectedMotionVideoBase64 = null;
  document.getElementById('motionVideoPreview').src = '';
  document.getElementById('motionVideoPreviewWrapper').style.display = 'none';
  document.getElementById('motionVideoBox').style.display = 'flex';
  document.getElementById('motionVideoInput').value = '';
}

function selectModel(btn, model) {
  document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedModel = model;
  updateCreditDisplay();
  
  const supportsEndFrame = model !== 'kling-v2-5-turbo-std' && model !== 'kling-v2-6-std';
  const endSection = document.getElementById('endFrameSection');
  endSection.style.display = (currentMode === 'image' && supportsEndFrame) ? 'block' : 'none';
  
  if (!supportsEndFrame) {
    selectedEndImageBase64 = null;
    document.getElementById('endImagePreview').style.display = 'none';
  }

  const audioOptions = document.getElementById('audioOptions');
  if (model === 'kling-v2-6-pro') {
    audioOptions.style.display = 'flex';
  } else {
    audioOptions.style.display = 'none';
    enableAudio = false;
    enableVoice = false;
    document.getElementById('btn-audio').classList.remove('active');
    document.getElementById('btn-voice').classList.remove('active');
  }
}

function toggleAudio() {
  enableAudio = !enableAudio;
  document.getElementById('btn-audio').classList.toggle('active', enableAudio);
  document.getElementById('audio-tip').style.display = enableAudio ? 'block' : 'none';
  if (enableAudio) {
    enableVoice = false;
    document.getElementById('btn-voice').classList.remove('active');
    document.getElementById('voice-tip').style.display = 'none';
  }
}

function toggleVoice() {
  enableVoice = !enableVoice;
  document.getElementById('btn-voice').classList.toggle('active', enableVoice);
  document.getElementById('voice-tip').style.display = enableVoice ? 'block' : 'none';
  if (enableVoice) {
    enableAudio = false;
    document.getElementById('btn-audio').classList.remove('active');
    document.getElementById('audio-tip').style.display = 'none';
  }
}

// ---- Duration selection ----
function selectDuration(btn, duration) {
  document.querySelectorAll('#dur-5, #dur-10').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedDuration = duration;
  updateCreditDisplay();
}

function selectRatio(btn, ratio) {
  document.querySelectorAll('#ratio-16-9, #ratio-9-16, #ratio-1-1').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedRatio = ratio;
}

function selectTextRatio(btn, ratio) {
  document.querySelectorAll('#text-ratio-16-9, #text-ratio-9-16, #text-ratio-1-1').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedTextRatio = ratio;
}

function selectImageRatio(btn, ratio) {
  document.querySelectorAll('#img-ratio-1-1, #img-ratio-16-9, #img-ratio-9-16, #img-ratio-4-3, #img-ratio-3-4').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedImageRatio = ratio;
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
        duration: selectedDuration,
        aspectRatio: currentMode === 'text' ? selectedTextRatio : selectedRatio,
        enableAudio,
        enableVoice
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
      body: JSON.stringify({ prompt, aspectRatio: selectedImageRatio })
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
          document.getElementById('aiImageDownloadBtn').onclick = async () => {
  try {
    const response = await fetch(statusData.imageUrl);
    const blob = await response.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'firemed-image.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch(err) {
    window.open(statusData.imageUrl, '_blank');
  }
};
          try {
    const profileRes = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentSession.access_token}` },
      body: JSON.stringify({ action: 'getProfile' })
    });
    const profileData = await profileRes.json();
    userCredits = profileData.profile?.credits ?? userCredits;
    document.getElementById('creditsDisplay').textContent = userCredits;
  } catch(e) {}
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
  document.getElementById('profileScreen').style.display = 'none';
  document.getElementById('pricingScreen').style.display = 'none';
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
  document.getElementById('profileScreen').style.display = 'none';
  document.getElementById('pricingScreen').style.display = 'none';
  document.getElementById('appScreen').querySelector('main').style.display = 'block';
}

function showProfile() {
  document.getElementById('appScreen').querySelector('main').style.display = 'none';
  document.getElementById('galleryScreen').style.display = 'none';
  document.getElementById('pricingScreen').style.display = 'none';
  document.getElementById('profileScreen').style.display = 'block';
  document.getElementById('profileEmail').textContent = currentUser?.email || '-';
  document.getElementById('profileCredits').textContent = userCredits;
  loadProfileStats();
}

function hideProfile() {
  document.getElementById('profileScreen').style.display = 'none';
  document.getElementById('galleryScreen').style.display = 'none';
  document.getElementById('pricingScreen').style.display = 'none';
  document.getElementById('appScreen').querySelector('main').style.display = 'block';
}

function showPricing() {
  document.getElementById('appScreen').querySelector('main').style.display = 'none';
  document.getElementById('galleryScreen').style.display = 'none';
  document.getElementById('profileScreen').style.display = 'none';
  document.getElementById('pricingScreen').style.display = 'block';
}

function hidePricing() {
  document.getElementById('pricingScreen').style.display = 'none';
  document.getElementById('galleryScreen').style.display = 'none';
  document.getElementById('profileScreen').style.display = 'none';
  document.getElementById('appScreen').querySelector('main').style.display = 'block';
}

function setTheme(theme) {
  document.querySelectorAll('[id^="theme-"]').forEach(b => b.classList.remove('active'));
  document.getElementById('theme-' + theme).classList.add('active');
  if (theme === 'fire') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  localStorage.setItem('firemed-theme', theme);
}

function loadTheme() {
  const saved = localStorage.getItem('firemed-theme');
  if (saved) setTheme(saved);
}

async function loadProfileStats() {
  try {
    const response = await fetch('/api/gallery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.access_token}`
      },
      body: JSON.stringify({})
    });
    const data = await response.json();
    const videos = data.generations?.filter(g => g.type === 'video').length || 0;
    const images = data.generations?.filter(g => g.type === 'image').length || 0;
    document.getElementById('profileVideos').textContent = videos;
    document.getElementById('profileImages').textContent = images;
  } catch(e) {}
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
      <div style="background:var(--surface); border-radius:12px; overflow:hidden; border:1px solid var(--border); cursor:pointer; display:inline-block; width:100%;">
        ${type === 'video'
          ? `<video src="${item.url}" style="width:100%; height:160px; object-fit:cover;" controls playsinline></video>`
          : `<img src="${item.url}" style="width:100%; height:auto; display:block;" onclick="openLightbox('${item.url}')" onerror="this.parentElement.style.display='none'" />`
        }
        <div style="padding:6px 8px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <div style="font-size:11px; color:var(--muted);">${new Date(item.created_at).toLocaleDateString()}</div>
          <a href="${item.url}" download="firemed-image.png" onclick="downloadFile('${item.url}', 'firemed-image.png'); return false;" style="background:var(--fire); color:#fff; border-radius:8px; padding:5px 12px; font-size:12px; font-weight:700; text-decoration:none; white-space:nowrap;">Download</a>
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

async function downloadFile(url, filename) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch(err) {
    window.open(url, '_blank');
  }
}

async function generateMotionVideo() {
  hideError();
  if (!selectedMotionImageBase64) {
    showError('Please upload a character photo first.');
    return;
  }
  if (!selectedMotionVideoBase64) {
    showError('Please upload a reference video first.');
    return;
  }
  const cost = calculateMotionCredits(selectedMotionVideoDuration || 5);
  if (userCredits < cost) {
    showError(`You need ${cost} credits. You have ${userCredits} credits.`);
    return;
  }
  showResultArea();
  try {
    const response = await fetch('/api/motion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.access_token}`
      },
      body: JSON.stringify({
        imageBase64: selectedMotionImageBase64,
        videoBase64: selectedMotionVideoBase64,
        prompt: document.getElementById('motionPrompt').value.trim(),
        selectedModel: selectedMotionModel
      })
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || 'Something went wrong.');
    pollMotionResult(data.id, cost);
  } catch (err) {
    showError(err.message || 'Could not generate video. Please try again.');
    hideResult();
  }
}

async function pollMotionResult(taskId, cost) {
  let attempts = 0;
  const maxAttempts = 120;
  pollingInterval = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      clearInterval(pollingInterval);
      showError('Video generation timed out. Please try again.');
      hideResult();
      return;
    }
    try {
      const response = await fetch('/api/motion', {
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
        await deductCredits(cost);
        showVideo(result.output);
      } else if (result.status === 'failed') {
        clearInterval(pollingInterval);
        showError('Video generation failed. Please try again.');
        hideResult();
      }
      const pct = Math.min(Math.round((attempts / maxAttempts) * 100), 95);
      document.getElementById('loadingPct').textContent = pct + '%';
    } catch (err) {
      clearInterval(pollingInterval);
      showError('Connection error. Please try again.');
      hideResult();
    }
  }, 3000);
}

// Başlat
updateCreditDisplay();
document.getElementById('endFrameSection').style.display = 'none';
loadTheme();
initAuth();
