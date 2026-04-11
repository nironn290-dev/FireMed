const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');
  const REPLICATE_TOKEN = process.env.REPLICATE_TOKEN;

  if (!prompt) return res.status(400).json({ error: 'Prompt required.' });
  if (!token) return res.status(401).json({ error: 'No token.' });

  // Kullanıcıyı doğrula
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: 'Invalid token.' });

  // Kredi kontrolü
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', user.id)
    .single();

  if (!profile || profile.credits < 2) {
    return res.status(400).json({ error: 'Insufficient credits. Please purchase more.' });
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

   let data;
try {
  data = await response.json();
} catch (e) {
  return res.status(500).json({ error: 'Replicate API error. Please try again.' });
}
if (data.error) return res.status(500).json({ error: data.error });

    if (data.status === 'succeeded' && data.output) {
      const imageUrl = Array.isArray(data.output) ? data.output[0] : data.output;
      return res.status(200).json({ imageUrl });
    }

    const predictionId = data.id;
    let attempts = 0;

    while (attempts < 30) {
      await new Promise(r => setTimeout(r, 2000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` }
      });
      let result;
try {
  result = await poll.json();
} catch (e) {
  attempts++;
  continue;
}
      
      if (result.status === 'succeeded' && result.output) {
        const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
        return res.status(200).json({ imageUrl });
      } else if (result.status === 'failed') {
        // Krediyi iade et
        await supabase
          .from('profiles')
          .update({ credits: profile.credits })
          .eq('id', user.id);
        return res.status(500).json({ error: 'Image generation failed.' });
      }
      attempts++;
    }

    return res.status(500).json({ error: 'Timeout.' });

  } catch (err) {
    // Hata olursa krediyi iade et
    await supabase
      .from('profiles')
      .update({ credits: profile.credits })
      .eq('id', user.id);
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
