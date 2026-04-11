module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  const REPLICATE_TOKEN = process.env.REPLICATE_TOKEN;

  if (!prompt) return res.status(400).json({ error: 'Prompt required.' });
  if (!REPLICATE_TOKEN) return res.status(500).json({ error: 'API key not configured.' });

  try {
    const response = await fetch('https://api.replicate.com/v1/models/prunaai/z-image-turbo/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({
        input: {
          prompt: prompt,
          width: 1024,
          height: 1024,
          num_inference_steps: 4,
          guidance_scale: 1.0
        }
      })
    });

    const data = await response.json();
    console.log('Replicate response:', JSON.stringify(data));

    if (data.error) return res.status(500).json({ error: data.error });

    if (data.status === 'succeeded' && data.output) {
      const imageUrl = Array.isArray(data.output) ? data.output[0] : data.output;
      return res.status(200).json({ imageUrl });
    }

    // Poll if not ready
    const predictionId = data.id;
    let attempts = 0;

    while (attempts < 30) {
      await new Promise(r => setTimeout(r, 2000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` }
      });
      const result = await poll.json();
      console.log('Poll result:', result.status, JSON.stringify(result.output));
      
      if (result.status === 'succeeded' && result.output) {
        const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
        return res.status(200).json({ imageUrl });
      } else if (result.status === 'failed') {
        return res.status(500).json({ error: 'Image generation failed.' });
      }
      attempts++;
    }

    return res.status(500).json({ error: 'Timeout.' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
