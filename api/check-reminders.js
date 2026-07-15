const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const DATE_FIELDS = [
  { key: 'wifeBirthday', label: '🎂 Ulang tahun istrimu' },
  { key: 'weddingAnniversary', label: '💍 Anniversary pernikahan' },
  { key: 'datingAnniversary', label: '💕 Anniversary jadian' },
  { key: 'fatherInLaw', label: '👨 Ulang tahun papa mertua' },
  { key: 'motherInLaw', label: '👩 Ulang tahun mama mertua' }
];

const SIBLING_SUFFIXES = ['Kakak1', 'Kakak2', 'Adik1', 'Adik2', 'Adik3'];

function daysUntilNext(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), month, day);
  if (next < today) next = new Date(today.getFullYear() + 1, month, day);
  return Math.round((next - today) / (24 * 60 * 60 * 1000));
}

async function notifyIfDue(token, label, dateStr, sent) {
  const days = daysUntilNext(dateStr);
  if (days === null) return;

  let title = null;
  if (days === 0) title = `${label} — HARI INI! 🎉`;
  else if (days === 7) title = `${label} — 7 hari lagi`;

  if (!title || !token) return;

  try {
    await admin.messaging().send({
      token,
      notification: { title, body: 'Buka MoodSync buat lihat detailnya' }
    });
    sent.push(label);
  } catch (err) {
    console.error('Gagal kirim reminder', label, err.message);
  }
}

module.exports = async (req, res) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection('couples').get();
    const sentSummary = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const dates = data.importantDates || {};
      const husbandToken = data.settings && data.settings.husbandToken;
      if (!husbandToken) continue;

      const sent = [];

      for (const field of DATE_FIELDS) {
        await notifyIfDue(husbandToken, field.label, dates[field.key], sent);
      }

      for (const suffix of SIBLING_SUFFIXES) {
        const name = dates['name' + suffix];
        const date = dates['date' + suffix];
        if (name && date) {
          await notifyIfDue(husbandToken, `👤 Ulang tahun ${name}`, date, sent);
        }
      }

      if (sent.length > 0) sentSummary.push({ couple: doc.id, sent });
    }

    res.status(200).json({ ok: true, checked: snapshot.size, notified: sentSummary });
  } catch (err) {
    console.error('Reminder check gagal', err);
    res.status(500).json({ error: err.message });
  }
};
