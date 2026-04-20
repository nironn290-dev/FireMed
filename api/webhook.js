const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const PLAN_CREDITS = {
  'FireMed Trial': 35,
  'FireMed Starter': 80,
  'FireMed Pro': 250,
};

function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return digest === signature;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['x-signature'];
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  const rawBody = JSON.stringify(req.body);

  if (!verifySignature(rawBody, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.headers['x-event-name'];
  const data = req.body;

  try {
    if (event === 'subscription_payment_success' || event === 'subscription_created') {
      const email = data.data?.attributes?.user_email;
      const productName = data.data?.attributes?.product_name || '';

      let credits = 0;
      for (const [plan, amount] of Object.entries(PLAN_CREDITS)) {
        if (productName.includes(plan)) {
          credits = amount;
          break;
        }
      }

      if (email && credits > 0) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single();

        if (profile) {
          await supabase
            .from('profiles')
            .update({ credits })
            .eq('id', profile.id);
        }
      }
    }

    if (event === 'subscription_cancelled') {
      const email = data.data?.attributes?.user_email;
      if (email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single();

        if (profile) {
          await supabase
            .from('profiles')
            .update({ credits: 0 })
            .eq('id', profile.id);
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
