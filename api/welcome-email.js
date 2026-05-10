const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required.' });

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'firemax.app@gmail.com',
        pass: 'tjfmkumwtbdusxmz'
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.sendMail({
      from: '"FireMax" <firemax.app@gmail.com>',
      to: email,
      subject: '🔥 Welcome to FireMax!',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h1 style="color:#ff4500;">🔥 Welcome to FireMax!</h1>
          <p>Your account has been created successfully.</p>
          <p>You have received <strong style="color:#ff4500;">5 free credits</strong> to get started!</p>
          <p>With your free credits you can generate AI images.</p>
          <p>Upgrade your plan to create amazing AI videos!</p>
          <br>
          <p>Enjoy creating!</p>
          <p><strong>The FireMax Team 🔥</strong></p>
        </div>
      `
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Email error:', err);
    return res.status(500).json({ error: err.message });
  }
}
