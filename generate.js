// api/generate.js — Vercel Serverless Function
// Hugging Face free API — image-to-video + text-to-video

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, prompt, imageBase64 } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) {
    return res.status(500).json({ error: 'API key not configured. Please contact support.' });
  }

  try {
    let response;

    if (mode === 'image' && imageBase64) {
      // Image-to-video: Stable Video Diffusion
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
            parameters: {
              num_frames: 25,
              num_inference_steps: 25,
              motion_bucket_id: 127,
              noise_aug_strength: 0.02,
            }
          })
        }
      );
    } else {
      // Text-to-video: LTX-Video (free)
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
            parameters: {
              num_frames: 25,
              num_inference_steps: 25,
              guidance_scale: 3.5,
              width: 704,
              height: 480,
            }
          })
        }
      );
    }

    // Handle errors
    if (!response.ok) {
      const errText = await response.text();
      console.error('HF error:', response.status, errText);

      if (response.status === 503) {
        return res.status(503).json({
          error: 'Our AI is warming up. Please wait 30 seconds and try again.'
        });
      }
      if (response.status === 429) {
        return res.status(429).json({
          error: 'Too many requests. Please wait a moment and try again.'
        });
      }
      return res.status(500).json({ error: 'Video generation failed. Please try again.' });
    }

    // Return video as base64
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const videoUrl = `data:video/mp4;base64,${base64}`;

    return res.status(200).json({ videoUrl });

  } catch (err) {
    console.error('Generate error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
