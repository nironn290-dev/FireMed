// Firemed — app.js

let currentMode = 'image';
let selectedStyle = 'realistic';
let selectedImageBase64 = null;
let pctInterval = null;

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

// ---- Example text prompts ----
function setTextPrompt(text) {
  document.getElementById('textPrompt').value = text;
  document.getElementById('textPrompt').focus();
}

// ---- Build full prompt ----
function buildPrompt(userPrompt, style) {
  const styleMap = {
    realistic:  'photorealistic, high quality, natural lighting, detailed',
    cinematic:  'cinematic film style, dramatic lighting, movie quality, wide angle shot',
    animation:  'smooth animation, vibrant colors, animated style, fluid motion',
    nature:     'nature documentary style, 4K, peaceful natural environment'
  };
  return `${userPrompt}. Style: ${styleMap[style] || styleMap.realistic}.`;
}

// ---- Main generate ----
async function generateVideo() {
  hideError();

  // Validate
  if (currentMode === 'image' && !selectedImageBase64) {
    showError('Please choose a photo first by tapping "Choose Photo".');
    return;
  }
  if (currentMode === 'text') {
    const tp = document.getElementById('textPrompt').value.trim();
    if (!tp || tp.length < 5) {
      showError('Please describe what you want to see in your video.');
      return;
    }
  }

  setLoading(true);
  showResultArea();

  try {
    let body;

    if (currentMode === 'image') {
      const desc = document.getElementById('prompt').value.trim();
      const prompt = buildPrompt(desc || 'Animate this image with natural smooth motion', selectedStyle);
      body = { mode: 'image', imageBase64: selectedImageBase64, prompt };
    } else {
      const prompt = buildPrompt(document.getElementById('textPrompt').value.trim(), selectedStyle);
      body = { mode: 'text', prompt };
    }

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || 'Something went wrong. Please try again.');
    }

    if (data.videoUrl) {
      showVideo(data.videoUrl);
    } else {
      throw new Error('No video returned. Please try again.');
    }

  } catch (err) {
    showError(err.message || 'Could not generate video. Please try again.');
    hideResult();
  } finally {
    setLoading(false);
  }
}

// ---- UI helpers ----
function setLoading(on) {
  const btn = document.getElementById('generateBtn');
  btn.disabled = on;
  btn.textContent = on ? 'GENERATING...' : 'GENERATE VIDEO';
  if (on) startPct(); else finishPct();
}

function startPct() {
  let p = 0;
  const el = document.getElementById('loadingPct');
  pctInterval = setInterval(() => {
    if (p < 90) { p += Math.random() * 3; el.textContent = Math.round(p) + '%'; }
  }, 700);
}
function finishPct() {
  clearInterval(pctInterval);
  document.getElementById('loadingPct').textContent = '100%';
}

function showResultArea() {
  const area = document.getElementById('resultArea');
  area.style.display = 'block';
  document.getElementById('loadingAnim').style.display = 'flex';
  document.getElementById('resultVideo').style.display = 'none';
  document.getElementById('resultFooter').style.display = 'none';
  document.getElementById('statusBadge').className = 'status-badge status-loading';
  document.getElementById('statusBadge').textContent = 'Generating...';
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
