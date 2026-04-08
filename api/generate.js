module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, predictionId, mode, imageBase64 } = req.body;
  const REPLICATE_TOKEN = process.env.REPLICATE_TOKEN;
  if (!REPLICATE_TOKEN) return res.status(500).json({ error: 'API key not configured.' });

  try {
    if (predictionId) {
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` }
      });
      const result = await poll.json();
      return res.status(200).json(result);
    }

    let response;

    if (mode === 'image' && imageBase64) {
      response = await fetch('https://api.replicate.com/v1/models/minimax/video-01-live/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REPLICATE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            prompt: prompt || 'animate this image naturally with smooth motion',
            first_frame_image: `data:image/jpeg;base64,${imageBase64}`
          }
        })
      });
    } else {
      if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });
      response = await fetch('https://api.replicate.com/v1/models/minimax/video-01/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REPLICATE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: { prompt } })
      });
    }

    const prediction = await response.json();
    if (prediction.error) return res.status(500).json({ error: prediction.error });
    return res.status(200).json({ id: prediction.id, status: prediction.status });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
