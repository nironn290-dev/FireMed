const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { reason } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) return res.status(401).json({ error: 'No token.' });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: 'Invalid token.' });

  try {
    // Supabase'e kaydet
    await supabase.from('reports').insert({
      user_id: user.id,
      reason: reason
    });

    // Email gönder
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'firemax.app@gmail.com',
        pass: 'tjfmkumwtbdusxmz'
      },
      tls: { rejectUnauthorized: false }
    });

    await transporter.sendMail({
      from: '"FireMax Reports" <firemax.app@gmail.com>',
      to: 'firemax.app@gmail.com',
      replyTo: user.email,
      subject: '🚩 New Content Report - FireMax',
      html: `
        <h2>New Content Report</h2>
        <p><strong>Reason:</strong> ${reason}</p>
        <p><strong>User Email:</strong> ${user.email}</p>
        <p><strong>User ID:</strong> ${user.id}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      `
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
