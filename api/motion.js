const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CREDIT_COSTS = {
  'kling-v2-6-pro': 11,
  'kling-v3-std': 13,
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, videoBase64, prompt, selectedModel, taskId } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');
  const ACCESS_KEY = process.env.KLING_ACCESS_KEY;
  const SECRET_KEY = process.env.KLING_SECRET_KEY;

  if (!ACCESS_KEY || !SECRET_KEY) {
    return res.status(500).json({ error: 'API keys not configured.' });
  }

  const klingToken = generateJWT(ACCESS_KEY, SECRET_KEY);

  // Polling
  if (taskId) {
    try {
      const poll = await fetch(`https://api.klingai.com/v1/videos/motion-control/${taskId}`, {
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
      return res.status(500).json({ error: 'Something went wrong.' });
    }
  }

  // Yeni üretim
  if (!token) return res.status(401).json({ error: 'No token.' });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: 'Invalid token.' });

  const modelKey = selectedModel || 'kling-v2-6-pro';
  const cost = CREDIT_COSTS[modelKey] || 11;

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', user.id)
    .single();

  if (!profile || profile.credits < cost) {
    return res.status(400).json({ error: `Insufficient credits. You need ${cost} credits.` });
  }

  // Krediyi düş
  await supabase
    .from('profiles')
    .update({ credits: profile.credits - cost })
    .eq('id', user.id);

  try {
    // Önce videoyu Supabase Storage'a yükle
    const videoBytes = Buffer.from(videoBase64, 'base64');
    const videoFileName = `motion_${user.id}_${Date.now()}.mp4`;
    
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(videoFileName, videoBytes, {
        contentType: 'video/mp4',
        upsert: false
      });

    if (uploadError) {
      await supabase.from('profiles').update({ credits: profile.credits }).eq('id', user.id);
      return res.status(500).json({ error: 'Failed to upload reference video.' });
    }

    const { data: publicUrlData } = supabase.storage
      .from('images')
      .getPublicUrl(videoFileName);

    const videoUrl = publicUrlData.publicUrl;

    // Kling API'ye gönder
    const modelName = selectedModel === 'kling-v3-std' ? 'kling-v3' : 'kling-v2-6';
const mode = selectedModel === 'kling-v3-std' ? 'std' : selectedModel === 'kling-v2-6-std' ? 'std' : 'pro';

    const response = await fetch('https://api.klingai.com/v1/videos/motion-control', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${klingToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_name: modelName,
        mode: mode,
        image: imageBase64,
        video_url: videoUrl,
        prompt: prompt || '',
        duration: '30',
        cfg_scale: 0.5
      })
    });

    const data = await response.json();

    if (!data.data || !data.data.task_id) {
      await supabase.from('profiles').update({ credits: profile.credits }).eq('id', user.id);
      return res.status(500).json({ error: data.message || 'Failed to start motion control.' });
    }

    return res.status(200).json({ id: data.data.task_id, status: 'processing' });

  } catch (err) {
    console.error(err);
    await supabase.from('profiles').update({ credits: profile.credits }).eq('id', user.id);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
