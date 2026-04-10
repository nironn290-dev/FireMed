const crypto = require('crypto');

function generateJWT(accessKey, secretKey) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: accessKey,
    exp: Math.floor(Date.now() / 1000) + 1800,
    nbf: Math.floor(Date.now() / 1000) - 5
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secretKey).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

const MODEL_CONFIG = {
  'kling-v2-5-turbo-std': { model_name: 'kling-v2-5-turbo', mode: 'std' },
  'kling-v2-5-turbo-pro': { model_name: 'kling-v2-5-turbo', mode: 'pro' },
  'kling-v2-6-pro':       { model_name: 'kling-v2-6', mode: 'pro' },
  'kling-v3-std':         { model_name: 'kling-v3', mode: 'std' },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, taskId, mode, imageBase64, endImageBase64, selectedModel, duration } = req.body;
  const ACCESS_KEY = process.env.KLING_ACCESS_KEY;
  const SECRET_KEY = process.env.KLING_SECRET_KEY;

  if (!ACCESS_KEY || !SECRET_KEY) {
    return res.status(500).json({ error: 'API keys not configured.' });
  }

  const token = generateJWT(ACCESS_KEY, SECRET_KEY);

  try {
    // Polling
    if (taskId) {
      const endpoint = mode === 'text'
        ? `https://api.klingai.com/v1/videos/text2video/${taskId}`
        : `https://api.klingai.com/v1/videos/image2video/${taskId}`;

      const poll = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await poll.json();

      if (result.data && result.data.task_status === 'succeed') {
        const videoUrl = result.data.works[0].resource.resource;
        return res.status(200).json({ status: 'succeeded', output: videoUrl });
      } else if (result.data && result.data.task_status === 'failed') {
        return res.status(200).json({ status: 'failed' });
      }
      return res.status(200).json({ status: 'processing' });
    }

    const modelKey = selectedModel || 'kling-v2-5-turbo-std';
    const config = MODEL_CONFIG[modelKey] || MODEL_CONFIG['kling-v2-5-turbo-std'];
    const videoDuration = duration || '5';

    let response;

    if (mode === 'text') {
      response = await fetch('https://api.klingai.com/v1/videos/text2video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_name: config.model_name,
          prompt: prompt,
          duration: videoDuration,
          mode: config.mode,
          cfg_scale: 0.5
        })
      });
    } else if (imageBase64 && endImageBase64) {
      // Start/End Frame
      response = await fetch('https://api.klingai.com/v1/videos/image2video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_name: config.model_name,
          image: imageBase64,
          image_tail: endImageBase64,
          prompt: prompt || '',
          duration: videoDuration,
          mode: config.mode,
          cfg_scale: 0.5
        })
      });
    } else {
      // Normal Image to Video
      response = await fetch('https://api.klingai.com/v1/videos/image2video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_name: config.model_name,
          image: imageBase64,
          prompt: prompt || 'animate this image naturally',
          duration: videoDuration,
          mode: config.mode,
          cfg_scale: 0.5
        })
      });
    }

    const data = await response.json();

    if (!data.data || !data.data.task_id) {
      return res.status(500).json({ error: data.message || 'Failed to start video generation.' });
    }

    return res.status(200).json({ id: data.data.task_id, status: 'processing', videoMode: mode });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
