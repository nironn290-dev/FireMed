const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

 const { prompt, aspectRatio } = req.body;
const token = req.headers.authorization?.replace('Bearer ', '');
  const REPLICATE_TOKEN = process.env.REPLICATE_TOKEN;

  if (!prompt) return res.status(400).json({ error: 'Prompt required.' });
  if (!token) return res.status(401).json({ error: 'No token.' });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: 'Invalid token.' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', user.id)
    .single();

  if (!profile || profile.credits < 2) {
    return res.status(400).json({ error: 'Insufficient credits.' });
  }

  // Krediyi düş
  await supabase
    .from('profiles')
    .update({ credits: profile.credits - 2 })
    .eq('id', user.id);

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
          width: aspectRatio === '16:9' ? 1280 : aspectRatio === '9:16' ? 720 : aspectRatio === '4:3' ? 1024 : aspectRatio === '3:4' ? 768 : 1024,
height: aspectRatio === '16:9' ? 720 : aspectRatio === '9:16' ? 1280 : aspectRatio === '4:3' ? 768 : aspectRatio === '3:4' ? 1024 : 1024,
num_inference_steps: 9,
guidance_scale: 0.0
        }
      })
    });

    const data = await response.json();
    if (data.error) {
      // Hata olursa krediyi iade et
      await supabase.from('profiles').update({ credits: profile.credits }).eq('id', user.id);
      return res.status(500).json({ error: data.error });
    }

    if (!data.id) {
  return res.status(500).json({ error: 'Failed to start image generation. Please try again.' });
}
return res.status(200).json({ predictionId: data.id });
  } catch (err) {
    await supabase.from('profiles').update({ credits: profile.credits }).eq('id', user.id);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
