const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

  const { action, queueId } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) return res.status(401).json({ error: 'No token.' });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: 'Invalid token.' });

  if (action === 'check') {
    const { data: myJob } = await supabase
      .from('motion_queue')
      .select('*')
      .eq('id', queueId)
      .single();

    if (!myJob) return res.status(404).json({ error: 'Queue job not found.' });

    if (myJob.task_id) {
      return res.status(200).json({ taskId: myJob.task_id, position: 0 });
    }

    const { count } = await supabase
      .from('motion_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing')
      .lt('created_at', myJob.created_at);

    if (count === 0) {
      const ACCESS_KEY = process.env.KLING_ACCESS_KEY;
      const SECRET_KEY = process.env.KLING_SECRET_KEY;
      const klingToken = generateJWT(ACCESS_KEY, SECRET_KEY);

      const modelName = myJob.selected_model === 'kling-v3-std' ? 'kling-v3' : 'kling-v2-6';
      const mode = myJob.selected_model === 'kling-v3-std' ? 'std' : 'pro';

      const response = await fetch('https://api.klingai.com/v1/videos/motion-control', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${klingToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_name: modelName,
          mode: mode,
          image_url: myJob.image_url,
          video_url: myJob.video_url,
          prompt: myJob.prompt || '',
          character_orientation: 'image',
        })
      });

      const data = await response.json();

      if (data.data?.task_id) {
        await supabase.from('motion_queue').update({ task_id: data.data.task_id, status: 'processing' }).eq('id', queueId);
        return res.status(200).json({ taskId: data.data.task_id, position: 0 });
      }
    }

    const { count: waitingCount } = await supabase
      .from('motion_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'waiting')
      .lt('created_at', myJob.created_at);

    return res.status(200).json({ position: waitingCount + 1 });
  }

  return res.status(400).json({ error: 'Invalid action.' });
}
