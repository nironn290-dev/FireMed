const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const REPLICATE_TOKEN = process.env.REPLICATE_TOKEN;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, queueId } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) return res.status(401).json({ error: 'No token.' });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: 'Invalid token.' });

  // Sıra pozisyonunu kontrol et
  if (action === 'check') {
    const { data: myJob } = await supabase
      .from('image_queue')
      .select('*')
      .eq('id', queueId)
      .single();

    if (!myJob) return res.status(404).json({ error: 'Queue job not found.' });

    // Eğer prediction_id varsa zaten başlatılmış
    if (myJob.prediction_id) {
      return res.status(200).json({ 
        status: 'processing', 
        predictionId: myJob.prediction_id,
        position: 0
      });
    }

    // Kaç tane önümde var?
    const { count } = await supabase
      .from('image_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing')
      .lt('created_at', myJob.created_at);

    if (count === 0) {
      // Sıram geldi! Replicate'e gönder
      const response = await fetch('https://api.replicate.com/v1/models/prunaai/z-image-turbo/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REPLICATE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            prompt: myJob.prompt,
            width: myJob.width,
            height: myJob.height,
            num_inference_steps: 9,
            guidance_scale: 0.0
          }
        })
      });

      const data = await response.json();

      if (data.id) {
        await supabase
          .from('image_queue')
          .update({ prediction_id: data.id, status: 'processing' })
          .eq('id', queueId);

        return res.status(200).json({ 
          status: 'processing', 
          predictionId: data.id,
          position: 0
        });
      } else {
        return res.status(200).json({ status: 'waiting', position: 1 });
      }
    }

    return res.status(200).json({ status: 'waiting', position: count });
  }

  return res.status(400).json({ error: 'Invalid action.' });
}
