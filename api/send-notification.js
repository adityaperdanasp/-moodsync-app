const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { token, title, body } = req.body || {};

  if (!token || !title) {
    res.status(400).json({ error: 'token dan title wajib diisi' });
    return;
  }

  try {
    await admin.messaging().send({
      token,
      notification: { title, body: body || '' }
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Gagal kirim notifikasi', err);
    res.status(500).json({ error: err.message });
  }
};
