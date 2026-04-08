// Firemed — app.js

let currentMode = 'image';
let selectedStyle = 'realistic';
let selectedImageBase64 = null;
let pollingInterval = null;

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

function selectStyle(btn, style) {
  document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedStyle = style;
}

function setTextPrompt(text) {
  document.getElementById('textPrompt').value = text;
  document.getElementById('textPrompt').focus();
}

function buildPrompt(userPrompt, style) {
  const styleMap = {
    realistic:  'photorealistic, high quality, natural lighting',
    cinematic:  'cinematic film style, dramatic lighting, movie quality',
    animation:  'smooth animation, vibrant colors, animated style',
    nature:     'nature documentary style, peaceful natural environment'
  };
  return `${userPrompt}. Style: ${styleMap[style] || styleMap.realistic}.`;
}

async function generateVideo() {
  hideError();

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
      headers: { 'Content-Type': 'application/json' },
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

async function pollResult(predictionId) {
  let attempts = 0;
  const maxAttempts = 60;

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictionId })
      });

      const result = await response.json();

      if (result.status === 'succeeded' && result.output) {
        clearInterval(pollingInterval);
        setLoading(false);
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

function setLoading(on) {
  const btn = document.getElementById('generateBtn');
  btn.disabled = on;
  btn.textContent = on ? 'GENERATING...' : 'GENERATE VIDEO';
}

funct
