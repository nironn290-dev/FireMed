const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, email, password } = req.body;

  try {
   if (action === 'signup') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ user: data.user, needsVerification: true });
}

if (action === 'verifyOtp') {
  const { token } = req.body;
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup'
  });
  if (error) return res.status(400).json({ error: error.message });
  
  // Profile oluştur - 5 kredi ver
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', data.user.id)
    .single();
    
  if (!existing) {
    await supabase.from('profiles').insert({
      id: data.user.id,
      credits: 5,
      welcomed: false
    });
  }

  // Hoş geldin emaili gönder
  const nodemailer = require('nodemailer');
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
      <h2>Welcome to FireMax! 🔥</h2>
      <p>Your account has been created successfully.</p>
      <p>You have received <strong>5 free credits</strong> to get started!</p>
      <p>With your credits you can generate AI images for free.</p>
      <br>
      <p>Enjoy creating amazing AI videos!</p>
      <p>The FireMax Team 🔥</p>
    `
  });
  return res.status(200).json({ user: data.user, session: data.session });
}

    if (action === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ 
        user: data.user, 
        session: data.session 
      });
    }

    if (action === 'getProfile') {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'No token' });
      
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return res.status(401).json({ error: 'Invalid token' });

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      return res.status(200).json({ profile });
    }
    if (action === 'markWelcomed') {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'No token' });
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return res.status(401).json({ error: 'Invalid token' });
      await supabase.from('profiles').update({ welcomed: true }).eq('id', user.id);
      return res.status(200).json({ success: true });
    }
    if (action === 'deductCredits') {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res.status(401).json({ error: 'Invalid token' });

  const amount = req.body.amount || 1;

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', user.id)
    .single();

  if (!profile || profile.credits < amount) {
    return res.status(400).json({ error: 'Insufficient credits' });
  }

  const { data: updated } = await supabase
    .from('profiles')
    .update({ credits: profile.credits - amount })
    .eq('id', user.id)
    .select()
    .single();

  return res.status(200).json({ credits: updated.credits });
}

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
