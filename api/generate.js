module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, prompt, imageBase64 } = req.body;

  if (!prompt && !imageBase64) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) {
    return res.status(500).json({ error: 'API key not configured.' });
  }

  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/damo-vilab/text-to-video-ms-1.7b',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
          'x-wait-for-model': 'true'
        },
        body: JSON.stringify({
          inputs: prompt || 'a beautiful scene',
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('HF error:', response.status, err);
      if (response.status === 503) {
        return res.status(503).json({ error: 'AI is warming up. Please wait 30 seconds and try again.' });
      }
      return res.status(500).json({ error: 'Video generation failed. Please try again.' });
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const videoUrl = `data:video/mp4;base64,${base64}`;

    return res.status(200).json({ videoUrl });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
