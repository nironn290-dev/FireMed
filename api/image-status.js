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
      const replicateUrl = Array.isArray(result.output) ? result.output[0] : result.output;
      const imageResponse = await fetch(replicateUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBytes = new Uint8Array(imageBuffer);
      const fileName = `${userId || 'anon'}_${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, imageBytes, {
          contentType: 'image/png',
          upsert: false
        });
      if (uploadError) {
        console.error('Upload error:', uploadError);
        if (userId) {
          await supabase.from('generations').insert({
            user_id: userId,
            type: 'image',
            url: replicateUrl,
            prompt: prompt || '',
            model: 'z-image-turbo'
          });
        }
        return res.status(200).json({ status: 'succeeded', imageUrl: replicateUrl });
      }
      const { data: publicUrlData } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);
      const permanentUrl = publicUrlData.publicUrl;
      if (userId) {
        await supabase.from('generations').insert({
          user_id: userId,
          type: 'image',
          url: permanentUrl,
          prompt: prompt || '',
          model: 'z-image-turbo'
        });
      }
      await supabase.from('image_queue').update({ status: 'completed' }).eq('prediction_id', predictionId);
      return res.status(200).json({ status: 'succeeded', imageUrl: permanentUrl });
    } else if (result.status === 'failed') {
      return res.status(200).json({ status: 'failed' });
    }
    return res.status(200).json({ status: 'processing' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
