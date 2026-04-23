const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CREDIT_COSTS = {
  'kling-v2-5-turbo-std': { '5': 6, '10': 11 },
  'kling-v2-5-turbo-pro': { '5': 11, '10': 18 },
  'kling-v2-6-std':       { '5': 6, '10': 11 },
  'kling-v2-6-pro':       { '5': 11, '10': 18 },
  'kling-v3-std':         { '5': 13, '10': 22 },
};

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
  'kling-v2-6-std':       { model_name: 'kling-v2-6', mode: 'std' },
  'kling-v2-6-pro':       { model_name: 'kling-v2-6', mode: 'pro' },
  'kling-v3-std':         { model_name: 'kling-v3', mode: 'std' },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, taskId, mode, imageBase64, endImageBase64, selectedModel, duration, aspectRatio, enableAudio, enableVoice } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');
  const ACCESS_KEY = process.env.KLING_ACCESS_KEY;
  const SECRET_KEY = process.env.KLING_SECRET_KEY;

  if (!ACCESS_KEY || !SECRET_KEY) {
    return res.status(500).json({ error: 'API keys not configured.' });
  }

  const klingToken = generateJWT(ACCESS_KEY, SECRET_KEY);

  // Polling modu - taskId varsa kredi kontrolü gerekmez
  if (taskId) {
    try {
      const endpoint = mode === 'text'
        ? `https://api.klingai.com/v1/videos/text2video/${taskId}`
        : `https://api.klingai.com/v1/videos/image2video/${taskId}`;

      const poll = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${klingToken}` }
      });
      const result = await poll.json();

      if (result.data && result.data.task_status === 'succeed') {
        const videoUrl = result.data.works[0].resource.resource;
        return res.status(200).json({ status: 'succeeded', output: videoUrl });
      } else if (result.data && result.data.task_status === 'failed') {
        return res.status(200).json({ status: 'failed' });
      }
      return res.status(200).json({ status: 'processing' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Polling failed.' });
    }
  }

  // Yeni video üretimi
  if (!token) return res.status(401).json({ error: 'No token.' });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: 'Invalid token.' });

  const modelKey = selectedModel || 'kling-v2-5-turbo-std';
  const videoDuration = duration || '5';
  const cost = CREDIT_COSTS[modelKey]?.[videoDuration] || 4;

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', user.id)
    .single();

  if (!profile || profile.credits < cost) {
    return res.status(400).json({ error: `Insufficient credits. You need ${cost} credits.` });
  }

  const { data: updatedProfile, error: updateError } = await supabase
    .from('profiles')
    .update({ credits: profile.credits - cost })
    .eq('id', user.id)
    .eq('credits', profile.credits)
    .select()
    .single();

  if (updateError || !updatedProfile) {
    return res.status(400).json({ error: 'Credit deduction failed. Please try again.' });
  }

  try {
    const config = MODEL_CONFIG[modelKey] || MODEL_CONFIG['kling-v2-5-turbo-std'];

    let response;

    if (mode === 'text') {
      response = await fetch('https://api.klingai.com/v1/videos/text2video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${klingToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_name: config.model_name,
          prompt: prompt,
          duration: videoDuration,
          mode: config.mode,
          aspect_ratio: aspectRatio,
          cfg_scale: 0.5,
          ...(enableAudio && { enable_audio: true }),
...(enableVoice && { enable_audio: true })
        })
      });
    } else if (imageBase64 && endImageBase64) {
      response = await fetch('https://api.klingai.com/v1/videos/image2video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${klingToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_name: config.model_name,
          image: imageBase64,
          image_tail: endImageBase64,
          prompt: prompt || '',
          duration: videoDuration,
          mode: config.mode,
          aspect_ratio: aspectRatio,
          cfg_scale: 0.5,
          ...(enableAudio && { enable_audio: true }),
...(enableVoice && { enable_audio: true })
        })
      });
    } else {
      response = await fetch('https://api.klingai.com/v1/videos/image2video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${klingToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_name: config.model_name,
          image: imageBase64,
          prompt: prompt || 'animate this image naturally',
          duration: videoDuration,
          mode: config.mode,
          aspect_ratio: aspectRatio,
          cfg_scale: 0.5,
          ...(enableAudio && { enable_audio: true }),
...(enableVoice && { enable_audio: true })
        })
      });
    }

    console.log('Kling response:', JSON.stringify(data));

    if (!data.data || !data.data.task_id) {
      // Hata durumunda krediyi geri ver
      await supabase
        .from('profiles')
        .update({ credits: profile.credits })
        .eq('id', user.id);
      return res.status(500).json({ error: data.message || 'Failed to start video generation.' });
    }

    return res.status(200).json({ id: data.data.task_id, status: 'processing', videoMode: mode });

  } catch (err) {
    console.error(err);
    // Hata durumunda krediyi geri ver
    await supabase
      .from('profiles')
      .update({ credits: profile.credits })
      .eq('id', user.id);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
