const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { predictionId, userId, prompt } = req.body;
  const REPLICATE_TOKEN = process.env.REPLICATE_TOKEN;

  if (!predictionId) return res.status(400).json({ error: 'Prediction ID required.' });

  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` }
    });

    const result = await response.json();

    if (result.status === 'succeeded' && result.output) {
      const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;

      // Supabase'e kaydet
      if (userId) {
        await supabase.from('generations').insert({
          user_id: userId,
          type: 'image',
          url: imageUrl,
          prompt: prompt || '',
          model: 'z-image-turbo'
        });
      }

      return res.status(200).json({ status: 'succeeded', imageUrl });
    } else if (result.status === 'failed') {
      return res.status(200).json({ status: 'failed' });
    }

    return res.status(200).json({ status: 'processing' });

  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
