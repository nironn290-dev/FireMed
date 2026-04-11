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

    if (data.error) return res.status(500).json({ error: data.error });

    // Poll for result
    const predictionId = data.id;
    let result = null;
    let attempts = 0;

    while (attempts < 30) {
      await new Promise(r => setTimeout(r, 2000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` }
      });
      result = await poll.json();
      if (result.status === 'succeeded') {
        return res.status(200).json({ imageUrl: result.output[0] });
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
