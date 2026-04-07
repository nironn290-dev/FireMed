module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, prompt, imageBase64 } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) {
    return res.status(500).json({ error: 'API key not configured.' });
  }

  try {
    let response;

    if (mode === 'image' && imageBase64) {
      response = await fetch(
        'https://api-inference.huggingface.co/models/stabilityai/stable-video-diffusion-img2vid-xt',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HF_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: imageBase64,
            parameters: { num_frames: 25, num_inference_steps: 25 }
          })
        }
      );
    } else {
      response = await fetch(
        'https://api-inference.huggingface.co/models/Lightricks/LTX-Video',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HF_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: { num_frames: 25, num_inference_steps: 25, guidance_scale: 3.5 }
          })
        }
      );
    }

    if (!response.ok) {
      if (response.status === 503) {
        return res.status(503).json({ error: 'AI is warming up. Please wait 30 seconds and try again.' });
      }
      if (response.status === 429) {
        return res.status(429).json({ error: 'Too many requests. Please wait and try again.' });
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
