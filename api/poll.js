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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { taskId, mode } = req.body;
  const ACCESS_KEY = process.env.KLING_ACCESS_KEY;
  const SECRET_KEY = process.env.KLING_SECRET_KEY;

  if (!taskId) return res.status(400).json({ error: 'No taskId provided.' });
  if (!ACCESS_KEY || !SECRET_KEY) return res.status(500).json({ error: 'API keys not configured.' });

  try {
    const klingToken = generateJWT(ACCESS_KEY, SECRET_KEY);

    const endpoint = mode === 'motion'
  ? `https://api.klingai.com/v1/videos/motion-control/${taskId}`
  : mode === 'text'
  ? `https://api.klingai.com/v1/videos/text2video/${taskId}`
  : `https://api.klingai.com/v1/videos/image2video/${taskId}`;

    const poll = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${klingToken}` }
    });

    const result = await poll.json();
    if (!result.data) {
  return res.status(500).json({ error: 'Kling error', details: result });
}

    if (result.data && result.data.task_status === 'succeed') {
      const work = result.data.works?.[0] || result.data.task_result?.videos?.[0];
const videoUrl = work?.resource?.resource || work?.url;
return res.status(200).json({ status: 'succeeded', output: videoUrl });
    } else if (result.data && result.data.task_status === 'failed') {
      return res.status(200).json({ status: 'failed' });
    }

    return res.status(200).json({ status: 'processing' });

  } catch (err) {
    console.error(err);
return res.status(500).json({ error: 'Polling failed.', details: err.message });  }
}
