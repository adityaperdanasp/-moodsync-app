  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
  import {
    getFirestore, doc, getDoc, setDoc, onSnapshot
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
  import {
    getMessaging, getToken, onMessage, isSupported
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

  const VAPID_KEY = "BInAhQBMr2o9v13_bKyYBdOCCwB22ZM326Vpyfda5V5KEAkH7xiXSTetf-aWm6lHYTD53tqzy_i_FddM6yzr7TA";

  // ============================================================
  // ISI DENGAN CONFIG DARI FIREBASE CONSOLE KAMU
  // (Project Settings > General > Your apps > SDK setup and configuration)
  // ============================================================
  const firebaseConfig = {
    apiKey: "AIzaSyA37TelLM0aPlOdoA9cvsUYKxtHxxUHcIc",
    authDomain: "moodsync-378bf.firebaseapp.com",
    projectId: "moodsync-378bf",
    storageBucket: "moodsync-378bf.firebasestorage.app",
    messagingSenderId: "344979040281",
    appId: "1:344979040281:web:7d2b6d2d6a7a429810a288"
  };

  const SESSION_KEY = 'moodsync-session'; // { role, coupleCode } — khusus device ini, tidak disinkron
  const COUPLES_COLLECTION = 'couples';

  const defaultData = {
    current: null,
    history: [],
    reactions: [],
    settings: { wifeGopayNumber: '' },
    debts: [],
    importantDates: {}
  };
  let data = { ...defaultData };
  let db = null;
  let docRef = null;
  let isFirebaseReady = false;
  let session = null; // { role: 'istri'|'suami', coupleCode: 'ABC123' }

  const syncBanner = document.getElementById('syncBanner');

  function setSyncStatus(status, text) {
    syncBanner.className = `sync-banner ${status}`;
    syncBanner.textContent = text;
  }

  let messaging = null;
  let fcmApp = null;

  try {
    fcmApp = initializeApp(firebaseConfig);
    db = getFirestore(fcmApp);
    isFirebaseReady = true;
  } catch (err) {
    console.error('Firebase init error', err);
    setSyncStatus('error', 'Gagal konek ke server, cek firebaseConfig');
  }

  async function setupNotifications() {
    try {
      const supported = await isSupported();
      if (!supported || !('serviceWorker' in navigator)) return;

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      messaging = getMessaging(fcmApp);

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
      });

      if (token && session) {
        const field = session.role === 'istri' ? 'wifeToken' : 'husbandToken';
        await saveData({ ...data, settings: { ...(data.settings || {}), [field]: token } });
      }

      onMessage(messaging, (payload) => {
        const title = payload.notification?.title || 'MoodSync';
        const body = payload.notification?.body || '';
        new Notification(title, { body });
      });
    } catch (err) {
      console.error('Setup notifikasi gagal', err);
    }
  }

  async function sendPushNotification(targetToken, title, body) {
    if (!targetToken) return;
    try {
      await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: targetToken, title, body })
      });
    } catch (err) {
      console.error('Gagal kirim notifikasi', err);
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSession(s) {
    session = s;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {}
  }

  function clearSession() {
    session = null;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {}
  }

  function generateCoupleCode() {
    const words = ['LOVE', 'CARE', 'HUGS', 'KISS', 'WARM', 'GLAD', 'CALM', 'DEAR', 'SWEE', 'CUTE'];
    const word = words[Math.floor(Math.random() * words.length)];
    const num = Math.floor(10 + Math.random() * 90);
    return `${word}${num}`;
  }

  async function saveData(newData) {
    data = newData;
    if (!isFirebaseReady) return;
    try {
      await setDoc(docRef, data);
    } catch (err) {
      console.error('Gagal menyimpan', err);
      setSyncStatus('error', 'Gagal menyimpan, cek koneksi internet');
    }
  }

  function startSync() {
    if (!isFirebaseReady) return;
    onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        data = { ...defaultData, ...snap.data() };
      } else {
        data = { ...defaultData };
        setDoc(docRef, data).catch((err) => console.error(err));
      }
      setSyncStatus('ok', 'Tersinkron ✓');
      renderAll();
    }, (err) => {
      console.error('Snapshot error', err);
      setSyncStatus('error', 'Koneksi terputus');
    });
  }

  const moods = [
    { id: 'senang', emoji: '😄', label: 'Senang', actions: [
      'Rayakan momennya, ajak dia cerita lebih detail',
      'Kasih pujian tulus atas apa yang bikin dia senang',
      'Ajak makan atau jalan santai buat rayain'
    ]},
    { id: 'lelah', emoji: '😴', label: 'Lelah', actions: [
      'Ambil alih tugas rumah tanpa diminta',
      'Kasih waktu istirahat, jangan minta apa-apa dulu',
      'Buatkan minuman hangat atau pijat ringan'
    ]},
    { id: 'stres', emoji: '😖', label: 'Stres', actions: [
      'Dengarkan tanpa buru-buru kasih solusi',
      'Tanya "aku bisa bantu apa?" bukan "kenapa gitu"',
      'Kurangi tuntutan/permintaan untuk sementara'
    ]},
    { id: 'sedih', emoji: '😢', label: 'Sedih', actions: [
      'Peluk dan tanya dia butuh ditemani atau butuh ruang',
      'Jangan menghakimi perasaannya',
      'Temani nonton/dengar hal yang dia suka'
    ]},
    { id: 'kesal', emoji: '😤', label: 'Kesal', actions: [
      'Beri jeda, jangan langsung membela diri',
      'Minta maaf dulu kalau kamu penyebabnya',
      'Ajak ngobrol setelah dia lebih tenang'
    ]},
    { id: 'kesepian', emoji: '🥺', label: 'Kesepian', actions: [
      'Luangkan waktu berdua tanpa gadget',
      'Kirim pesan perhatian di sela kerja',
      'Ajak quality time walau cuma ngobrol santai'
    ]},
    { id: 'romantis', emoji: '🥰', label: 'Kangen', actions: [
      'Kasih kejutan kecil, mis. bunga atau makanan favorit',
      'Ucapkan hal-hal yang kamu syukuri tentang dia',
      'Matikan HP, fokus berdua sebentar'
    ]},
    { id: 'bosan', emoji: '🙄', label: 'Bosan', actions: [
      'Ajak coba aktivitas baru bareng',
      'Rencanakan date sederhana di luar rutinitas',
      'Tanya apa yang dia pengen coba akhir-akhir ini'
    ]}
  ];

  const reactionTypes = {
    uang: { emoji: '💸', text: 'Suami baru saja mengirim uang buat kamu!' },
    bunga: { emoji: '💐', text: 'Suami memesan bunga buat kamu!' },
    makanan: { emoji: '🍱', text: 'Suami baru saja pesenin makanan buat kamu!' }
  };

  let selectedMoodId = null;

  const moodGrid = document.getElementById('moodGrid');
  const noteInput = document.getElementById('noteInput');
  const saveMoodBtn = document.getElementById('saveMoodBtn');
  const historyList = document.getElementById('historyList');
  const notifArea = document.getElementById('notifArea');

  const statusBanner = document.getElementById('statusBanner');
  const noteDisplay = document.getElementById('noteDisplay');
  const suggestionList = document.getElementById('suggestionList');
  const reactionFeedback = document.getElementById('reactionFeedback');
  const flowerOverlay = document.getElementById('flowerOverlay');
  const gopayOverlay = document.getElementById('gopayOverlay');
  const gopayInput = document.getElementById('gopayInput');
  const saveGopayBtn = document.getElementById('saveGopayBtn');
  const gopaySavedMsg = document.getElementById('gopaySavedMsg');
  const gopayNumberDisplay = document.getElementById('gopayNumberDisplay');
  const copyGopayBtn = document.getElementById('copyGopayBtn');
  const openGopayAppBtn = document.getElementById('openGopayAppBtn');
  const shareLocationBtn = document.getElementById('shareLocationBtn');
  const locationShareMsg = document.getElementById('locationShareMsg');
  const streakCard = document.getElementById('streakCard');
  const streakTitle = document.getElementById('streakTitle');
  const streakSub = document.getElementById('streakSub');

  // Debt elements
  const wifeDebtTotal = document.getElementById('wifeDebtTotal');
  const wifeDebtTotalAmt = document.getElementById('wifeDebtTotalAmt');
  const wifeDebtList = document.getElementById('wifeDebtList');
  const debtDateInput = document.getElementById('debtDateInput');
  const debtAmountInput = document.getElementById('debtAmountInput');
  const debtDescInput = document.getElementById('debtDescInput');
  const addDebtBtn = document.getElementById('addDebtBtn');
  const husbandDebtTotal = document.getElementById('husbandDebtTotal');
  const husbandDebtTotalAmt = document.getElementById('husbandDebtTotalAmt');
  const husbandDebtList = document.getElementById('husbandDebtList');
  const husbandDebtEmpty = document.getElementById('husbandDebtEmpty');

  // Important dates elements
  const dateFieldIds = {
    wifeBirthday: 'dateWifeBirthday',
    weddingAnniversary: 'dateWeddingAnniversary',
    datingAnniversary: 'dateDatingAnniversary',
    fatherInLaw: 'dateFatherInLaw',
    motherInLaw: 'dateMotherInLaw'
  };
  const saveDatesBtn = document.getElementById('saveDatesBtn');
  const datesSavedMsg = document.getElementById('datesSavedMsg');
  const datesCard = document.getElementById('datesCard');
  const datesInfoGrid = document.getElementById('datesInfoGrid');
  const locationCard = document.getElementById('locationCard');
  const locationTime = document.getElementById('locationTime');
  const openMapsLink = document.getElementById('openMapsLink');
  const foodOverlay = document.getElementById('foodOverlay');
  const openGofoodBtn = document.getElementById('openGofoodBtn');
  const openGrabfoodBtn = document.getElementById('openGrabfoodBtn');
  const openShopeefoodBtn = document.getElementById('openShopeefoodBtn');

  function renderMoodGrid() {
    moodGrid.innerHTML = moods.map(m => `
      <div class="mood-btn ${selectedMoodId === m.id ? 'selected' : ''}" data-id="${m.id}">
        <span class="emoji">${m.emoji}</span>
        ${m.label}
      </div>
    `).join('');
    moodGrid.querySelectorAll('.mood-btn').forEach(el => {
      el.addEventListener('click', () => {
        selectedMoodId = el.dataset.id;
        renderMoodGrid();
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function timeAgo(ts) {
    const diff = Math.floor((Date.now() - ts) / 60000);
    if (diff < 1) return 'Baru saja';
    if (diff < 60) return `${diff} menit lalu`;
    const hrs = Math.floor(diff / 60);
    if (hrs < 24) return `${hrs} jam lalu`;
    return `${Math.floor(hrs / 24)} hari lalu`;
  }

  function dayKey(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function computeStreak(history) {
    if (!history || history.length === 0) return 0;
    const days = [...new Set(history.map(h => dayKey(h.ts)))];
    const dayMs = 24 * 60 * 60 * 1000;
    let streak = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    // Boleh mulai dari hari ini atau kemarin (kalau belum isi hari ini, streak tetap dihitung dari kemarin)
    if (!days.includes(dayKey(cursor.getTime()))) {
      cursor = new Date(cursor.getTime() - dayMs);
    }

    while (days.includes(dayKey(cursor.getTime()))) {
      streak++;
      cursor = new Date(cursor.getTime() - dayMs);
    }
    return streak;
  }

  function renderStreak() {
    const streak = computeStreak(data.history);
    if (streak < 2) {
      streakCard.style.display = 'none';
      return;
    }
    streakCard.style.display = 'block';
    streakTitle.textContent = `Streak Kamu 🔥`;
    streakSub.textContent = `${streak} hari berturut-turut istrimu isi mood`;
  }

  function formatRupiah(num) {
    const n = Number(num) || 0;
    return 'Rp ' + n.toLocaleString('id-ID');
  }

  function formatTanggal(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  function daysUntilNext(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let next = new Date(today.getFullYear(), month, day);
    if (next < today) next = new Date(today.getFullYear() + 1, month, day);
    return Math.round((next - today) / (24 * 60 * 60 * 1000));
  }

  function countdownBadge(dateStr) {
    const days = daysUntilNext(dateStr);
    if (days === null) return '';
    if (days === 0) return `<span class="cd soon">Hari ini! 🎉</span>`;
    if (days <= 7) return `<span class="cd soon">${days} hari lagi</span>`;
    if (days <= 30) return `<span class="cd">${days} hari lagi</span>`;
    return '';
  }

  function renderDebtList(listEl, totalEl, totalAmtEl, emptyEl, interactive) {
    const debts = data.debts || [];
    const unpaidTotal = debts.filter(d => !d.paid).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    if (debts.length === 0) {
      listEl.innerHTML = '';
      totalEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    totalEl.style.display = 'flex';
    totalAmtEl.textContent = formatRupiah(unpaidTotal);

    listEl.innerHTML = debts.map((d, i) => `
      <li class="debt-item">
        <div class="debt-check ${d.paid ? 'done' : ''}" data-idx="${i}">${d.paid ? '✓' : ''}</div>
        <div class="debt-no">${i + 1}</div>
        <div class="debt-body">
          <div class="debt-desc">${escapeHtml(d.desc || '')}</div>
          <div class="debt-date">${formatTanggal(d.date)}</div>
        </div>
        <div class="debt-amt ${d.paid ? 'paid' : ''}">${formatRupiah(d.amount)}</div>
      </li>
    `).join('');

    if (interactive) {
      listEl.querySelectorAll('.debt-check').forEach(el => {
        el.addEventListener('click', async () => {
          const idx = parseInt(el.dataset.idx, 10);
          const newDebts = data.debts.map((d, i) => i === idx ? { ...d, paid: !d.paid } : d);
          await saveData({ ...data, debts: newDebts });
        });
      });
    }
  }

  function renderDebts() {
    renderDebtList(wifeDebtList, wifeDebtTotal, wifeDebtTotalAmt, null, true);
    renderDebtList(husbandDebtList, husbandDebtTotal, husbandDebtTotalAmt, husbandDebtEmpty, true);
  }

  function renderImportantDatesWife() {
    const dates = data.importantDates || {};
    Object.keys(dateFieldIds).forEach(key => {
      const el = document.getElementById(dateFieldIds[key]);
      if (el && document.activeElement !== el) el.value = dates[key] || '';
    });
    ['Kakak1', 'Kakak2', 'Adik1', 'Adik2', 'Adik3'].forEach(suffix => {
      const nameEl = document.getElementById('name' + suffix);
      const dateEl = document.getElementById('date' + suffix);
      if (nameEl && document.activeElement !== nameEl) nameEl.value = dates['name' + suffix] || '';
      if (dateEl && document.activeElement !== dateEl) dateEl.value = dates['date' + suffix] || '';
    });
  }

  function renderImportantDatesHusband() {
    const dates = data.importantDates || {};
    const tiles = [];

    if (dates.wifeBirthday) {
      tiles.push(`<div class="info-tile wide"><div class="k">🎂 Ulang tahun istri</div><div class="v">${formatTanggal(dates.wifeBirthday)} ${countdownBadge(dates.wifeBirthday)}</div></div>`);
    }
    if (dates.weddingAnniversary) {
      tiles.push(`<div class="info-tile"><div class="k">💍 Anniv. pernikahan</div><div class="v">${formatTanggal(dates.weddingAnniversary)} ${countdownBadge(dates.weddingAnniversary)}</div></div>`);
    }
    if (dates.datingAnniversary) {
      tiles.push(`<div class="info-tile"><div class="k">💕 Anniv. jadian</div><div class="v">${formatTanggal(dates.datingAnniversary)} ${countdownBadge(dates.datingAnniversary)}</div></div>`);
    }
    if (dates.fatherInLaw) {
      tiles.push(`<div class="info-tile"><div class="k">👨 Ultah papa mertua</div><div class="v">${formatTanggal(dates.fatherInLaw)} ${countdownBadge(dates.fatherInLaw)}</div></div>`);
    }
    if (dates.motherInLaw) {
      tiles.push(`<div class="info-tile"><div class="k">👩 Ultah mama mertua</div><div class="v">${formatTanggal(dates.motherInLaw)} ${countdownBadge(dates.motherInLaw)}</div></div>`);
    }
    [['Kakak1', 'kakak ipar'], ['Kakak2', 'kakak ipar'], ['Adik1', 'adik ipar'], ['Adik2', 'adik ipar'], ['Adik3', 'adik ipar']].forEach(([suffix, label]) => {
      const name = dates['name' + suffix];
      const date = dates['date' + suffix];
      if (name && date) {
        tiles.push(`<div class="info-tile wide"><div class="k">👤 Ultah ${escapeHtml(name)} (${label})</div><div class="v">${formatTanggal(date)} ${countdownBadge(date)}</div></div>`);
      }
    });

    if (tiles.length === 0) {
      datesCard.style.display = 'none';
      return;
    }
    datesCard.style.display = 'block';
    datesInfoGrid.innerHTML = tiles.join('');
  }

  addDebtBtn.addEventListener('click', async () => {
    const date = debtDateInput.value;
    const amount = debtAmountInput.value;
    const desc = debtDescInput.value.trim();
    if (!date || !amount || !desc) {
      alert('Isi tanggal, nominal, dan deskripsi dulu ya');
      return;
    }
    const newDebt = { date, amount: Number(amount), desc, paid: false, ts: Date.now() };
    const newDebts = [...(data.debts || []), newDebt];
    await saveData({ ...data, debts: newDebts });

    const husbandToken = data.settings && data.settings.husbandToken;
    sendPushNotification(husbandToken, '💳 Hutang baru dicatat', `${desc} — ${formatRupiah(amount)}`);

    debtDateInput.value = '';
    debtAmountInput.value = '';
    debtDescInput.value = '';
  });

  saveDatesBtn.addEventListener('click', async () => {
    const newDates = { ...(data.importantDates || {}) };
    Object.keys(dateFieldIds).forEach(key => {
      const el = document.getElementById(dateFieldIds[key]);
      if (el) newDates[key] = el.value;
    });
    ['Kakak1', 'Kakak2', 'Adik1', 'Adik2', 'Adik3'].forEach(suffix => {
      const nameEl = document.getElementById('name' + suffix);
      const dateEl = document.getElementById('date' + suffix);
      if (nameEl) newDates['name' + suffix] = nameEl.value.trim();
      if (dateEl) newDates['date' + suffix] = dateEl.value;
    });
    await saveData({ ...data, importantDates: newDates });
    datesSavedMsg.textContent = 'Tanggal tersimpan ✓';
    setTimeout(() => { datesSavedMsg.textContent = ''; }, 2000);
  });

  function renderNotifs() {
    const recent = (data.reactions || []).slice().reverse().slice(0, 3);
    if (recent.length === 0) {
      notifArea.innerHTML = '';
      return;
    }
    notifArea.innerHTML = recent.map(r => {
      const rt = reactionTypes[r.type];
      return `
        <div class="notif-banner">
          <div class="n-emoji">${rt ? rt.emoji : '💌'}</div>
          <div>
            <div class="n-text">${rt ? rt.text : 'Suami baru saja mengirim sesuatu untukmu!'}</div>
            <div class="n-time">${timeAgo(r.ts)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderHistory() {
    if (data.history.length === 0) {
      historyList.innerHTML = '<div class="empty">Belum ada riwayat</div>';
      return;
    }
    historyList.innerHTML = data.history.slice().reverse().slice(0, 10).map(h => {
      const m = moods.find(x => x.id === h.moodId);
      return `<div class="history-item">${m ? m.emoji : ''} <b>${m ? m.label : h.moodId}</b> — ${timeAgo(h.ts)}</div>`;
    }).join('');
  }

  saveMoodBtn.addEventListener('click', async () => {
    if (!selectedMoodId) {
      alert('Pilih mood dulu ya');
      return;
    }
    const entry = {
      moodId: selectedMoodId,
      note: noteInput.value.trim(),
      ts: Date.now(),
      doneActions: []
    };
    const next = { ...data, current: entry, history: [...data.history, entry] };
    await saveData(next);

    const m = moods.find(x => x.id === entry.moodId);
    const husbandToken = data.settings && data.settings.husbandToken;
    sendPushNotification(
      husbandToken,
      `${m ? m.emoji : '💞'} Istrimu lagi ${m ? m.label.toLowerCase() : 'update mood'}`,
      entry.note || 'Buka MoodSync buat lihat apa yang perlu kamu lakukan'
    );

    noteInput.value = '';
    selectedMoodId = null;
    saveMoodBtn.textContent = 'Terkirim ✓';
    setTimeout(() => { saveMoodBtn.textContent = 'Kirim ke Suami'; }, 1500);
  });

  function renderHusbandView() {
    if (!data.current) {
      statusBanner.innerHTML = '<div class="empty">Belum ada update hari ini<span class="empty-sub">Yuk isi mood istri sekarang</span></div>';
      noteDisplay.innerHTML = '';
      suggestionList.innerHTML = '<div class="empty">Belum ada saran, tunggu istrimu isi mood dulu</div>';
      return;
    }
    const m = moods.find(x => x.id === data.current.moodId);
    statusBanner.innerHTML = `
      <div class="emoji-big">${m ? m.emoji : '❓'}</div>
      <div>
        <div class="label">${m ? m.label : data.current.moodId}</div>
        <div class="time">${timeAgo(data.current.ts)}</div>
      </div>
    `;
    noteDisplay.innerHTML = data.current.note
      ? `<div class="note-box">"${escapeHtml(data.current.note)}"</div>`
      : '';

    const actions = m ? m.actions : [];
    const doneSet = new Set(data.current.doneActions || []);
    suggestionList.innerHTML = actions.map((a, i) => `
      <li class="${doneSet.has(i) ? 'done' : ''}" data-idx="${i}">
        <span class="tick">${doneSet.has(i) ? '✓' : ''}</span>
        <span class="text">${escapeHtml(a)}</span>
      </li>
    `).join('');

    suggestionList.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', async () => {
        const idx = parseInt(li.dataset.idx, 10);
        const done = new Set(data.current.doneActions || []);
        if (done.has(idx)) done.delete(idx); else done.add(idx);
        const newDoneActions = [...done];
        const newCurrent = { ...data.current, doneActions: newDoneActions };
        const newHistory = data.history.map(h =>
          h.ts === newCurrent.ts ? { ...h, doneActions: newDoneActions } : h
        );
        await saveData({ ...data, current: newCurrent, history: newHistory });
      });
    });
  }

  const wifeView = document.getElementById('wifeView');
  const husbandView = document.getElementById('husbandView');

  function showViewForRole(role) {
    if (role === 'istri') {
      wifeView.classList.add('active');
      husbandView.classList.remove('active');
    } else {
      husbandView.classList.add('active');
      wifeView.classList.remove('active');
    }
  }

  // Reactions
  async function logReaction(type) {
    const newReactions = [...(data.reactions || []), { type, ts: Date.now() }];
    await saveData({ ...data, reactions: newReactions });

    const wifeToken = data.settings && data.settings.wifeToken;
    const rt = reactionTypes[type];
    sendPushNotification(wifeToken, `${rt ? rt.emoji : '💌'} Notifikasi dari suami`, rt ? rt.text : 'Suami baru saja mengirim sesuatu untukmu!');
  }

  document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.action;

      if (type === 'bunga') {
        flowerOverlay.classList.add('open');
        return;
      }

      if (type === 'uang') {
        const num = (data.settings && data.settings.wifeGopayNumber) || '';
        gopayNumberDisplay.textContent = num ? num : 'Nomor belum diisi istri';
        gopayOverlay.classList.add('open');
        return;
      }

      if (type === 'makanan') {
        foodOverlay.classList.add('open');
        return;
      }

      await logReaction(type);
      renderReactionFeedback(type);
    });
  });

  function openAppBestEffort(scheme) {
    window.location.href = scheme;
  }

  openGofoodBtn.addEventListener('click', async () => {
    openAppBestEffort('gojek://gofood');
    foodOverlay.classList.remove('open');
    await logReaction('makanan');
    renderReactionFeedback('makanan');
  });

  openGrabfoodBtn.addEventListener('click', async () => {
    openAppBestEffort('grab://open?screenType=FOOD');
    foodOverlay.classList.remove('open');
    await logReaction('makanan');
    renderReactionFeedback('makanan');
  });

  openShopeefoodBtn.addEventListener('click', async () => {
    openAppBestEffort('shopeeid://');
    foodOverlay.classList.remove('open');
    await logReaction('makanan');
    renderReactionFeedback('makanan');
  });

  document.getElementById('foodClose').addEventListener('click', () => {
    foodOverlay.classList.remove('open');
  });
  foodOverlay.addEventListener('click', (e) => {
    if (e.target === foodOverlay) foodOverlay.classList.remove('open');
  });

  copyGopayBtn.addEventListener('click', async () => {
    const num = (data.settings && data.settings.wifeGopayNumber) || '';
    if (!num) {
      alert('Istri belum isi nomor GoPay-nya');
      return;
    }
    try {
      await navigator.clipboard.writeText(num);
      copyGopayBtn.textContent = 'Tersalin ✓';
    } catch {
      copyGopayBtn.textContent = num;
    }
    await logReaction('uang');
    setTimeout(() => { copyGopayBtn.textContent = 'Copy Nomor'; }, 1500);
  });

  openGopayAppBtn.addEventListener('click', () => {
    // Best-effort: GoPay/Gojek tidak punya deep link resmi buat prefill nomor/nominal,
    // ini cuma coba buka app-nya kalau terinstall. Kalau gagal, browser diam saja.
    window.location.href = 'gojek://gopay/home';
  });

  document.getElementById('gopayClose').addEventListener('click', () => {
    gopayOverlay.classList.remove('open');
  });
  gopayOverlay.addEventListener('click', (e) => {
    if (e.target === gopayOverlay) gopayOverlay.classList.remove('open');
  });

  saveGopayBtn.addEventListener('click', async () => {
    const num = gopayInput.value.trim();
    if (!num) {
      alert('Isi nomor GoPay dulu ya');
      return;
    }
    await saveData({ ...data, settings: { ...(data.settings || {}), wifeGopayNumber: num } });
    gopaySavedMsg.textContent = 'Nomor tersimpan ✓';
    setTimeout(() => { gopaySavedMsg.textContent = ''; }, 2000);
  });

  shareLocationBtn.addEventListener('click', () => {
    if (!('geolocation' in navigator)) {
      locationShareMsg.style.color = '#c92a2a';
      locationShareMsg.textContent = 'Browser kamu tidak mendukung fitur lokasi';
      return;
    }
    shareLocationBtn.disabled = true;
    shareLocationBtn.textContent = 'Mencari lokasi...';
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now() };
        await saveData({ ...data, settings: { ...(data.settings || {}), wifeLocation: loc } });

        const husbandToken = data.settings && data.settings.husbandToken;
        sendPushNotification(husbandToken, '📍 Istrimu membagikan lokasi', 'Buka MoodSync buat lihat lokasinya di peta');

        locationShareMsg.style.color = '#2f9e44';
        locationShareMsg.textContent = 'Lokasi berhasil dibagikan ✓';
        shareLocationBtn.disabled = false;
        shareLocationBtn.textContent = 'Bagikan Lokasi Sekarang';
        setTimeout(() => { locationShareMsg.textContent = ''; }, 3000);
      },
      (err) => {
        console.error('Geolocation error', err);
        locationShareMsg.style.color = '#c92a2a';
        locationShareMsg.textContent = 'Gagal ambil lokasi. Pastikan izin lokasi diaktifkan.';
        shareLocationBtn.disabled = false;
        shareLocationBtn.textContent = 'Bagikan Lokasi Sekarang';
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  function renderReactionFeedback(type) {
    const messages = {
      uang: 'Notifikasi terkirim ke istrimu. Sekarang buka aplikasi mobile banking/e-wallet kamu untuk transfer beneran ya.',
      makanan: 'Notifikasi terkirim ke istrimu. Sekarang buka GoFood/GrabFood/ShopeeFood untuk pesan makanan favoritnya.'
    };
    reactionFeedback.innerHTML = `<div class="feedback-msg">${messages[type] || 'Notifikasi terkirim ke istrimu!'}</div>`;
  }

  document.getElementById('flowerClose').addEventListener('click', () => {
    flowerOverlay.classList.remove('open');
  });
  flowerOverlay.addEventListener('click', (e) => {
    if (e.target === flowerOverlay) flowerOverlay.classList.remove('open');
  });
  document.querySelectorAll('.flower-wa-link').forEach(link => {
    link.addEventListener('click', async () => {
      await logReaction('bunga');
      flowerOverlay.classList.remove('open');
      renderReactionFeedback('bunga');
    });
  });

  function renderLocationCard() {
    const loc = data.settings && data.settings.wifeLocation;
    if (!loc) {
      locationCard.style.display = 'none';
      return;
    }
    locationCard.style.display = 'block';
    locationTime.textContent = `Terakhir dibagikan: ${timeAgo(loc.ts)}`;
    openMapsLink.href = `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
  }

  function renderAll() {
    renderMoodGrid();
    renderHistory();
    renderHusbandView();
    renderNotifs();
    renderLocationCard();
    renderStreak();
    renderDebts();
    renderImportantDatesWife();
    renderImportantDatesHusband();
    if (document.activeElement !== gopayInput) {
      gopayInput.value = (data.settings && data.settings.wifeGopayNumber) || '';
    }
  }

  // ============================================================
  // ONBOARDING
  // ============================================================
  const onboardOverlay = document.getElementById('onboardOverlay');
  const appRoot = document.getElementById('appRoot');
  const greetingAvatar = document.getElementById('greetingAvatar');
  const greetingTitle = document.getElementById('greetingTitle');
  const greetingSub = document.getElementById('greetingSub');

  function renderGreeting(role) {
    if (role === 'istri') {
      greetingAvatar.innerHTML = '<img src="assets/avatar-istri.png" alt="Istri">';
      greetingTitle.textContent = 'Hai, Istri Cantik! 💕';
      greetingSub.textContent = 'Yuk, ceritakan perasaanmu hari ini';
    } else {
      greetingAvatar.innerHTML = '<img src="assets/avatar-suami.png" alt="Suami">';
      greetingTitle.textContent = 'Hai, Suami Hebat! 👋';
      greetingSub.textContent = 'Yuk, bahagiakan istrimu hari ini';
    }
  }

  const stepRole = document.getElementById('stepRole');
  const stepPair = document.getElementById('stepPair');
  const stepShowCode = document.getElementById('stepShowCode');
  const stepJoinCode = document.getElementById('stepJoinCode');

  let pendingRole = null;

  function showStep(step) {
    [stepRole, stepPair, stepShowCode, stepJoinCode].forEach(s => s.style.display = 'none');
    step.style.display = 'block';
  }

  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      pendingRole = btn.dataset.role;
    });
  });

  document.getElementById('roleNextBtn').addEventListener('click', () => {
    if (!pendingRole) {
      alert('Pilih peran kamu dulu ya');
      return;
    }
    showStep(stepPair);
  });

  document.getElementById('backToRoleBtn').addEventListener('click', () => showStep(stepRole));
  document.getElementById('backToPairBtn').addEventListener('click', () => showStep(stepPair));
  document.getElementById('backToPairBtn2').addEventListener('click', () => showStep(stepPair));

  let createdCode = null;

  document.getElementById('createPairBtn').addEventListener('click', async () => {
    if (!isFirebaseReady) {
      alert('Koneksi ke server belum siap, cek firebaseConfig');
      return;
    }
    createdCode = generateCoupleCode();
    document.getElementById('generatedCode').textContent = createdCode;
    try {
      await setDoc(doc(db, COUPLES_COLLECTION, createdCode), defaultData);
      showStep(stepShowCode);
    } catch (err) {
      console.error(err);
      alert('Gagal membuat kode pasangan, coba lagi');
    }
  });

  document.getElementById('shareCodeBtn').addEventListener('click', () => {
    const text = `Yuk connect di MoodSync! Masukkan kode pasangan ini: ${createdCode}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  });

  document.getElementById('continueAfterCreateBtn').addEventListener('click', () => {
    bootApp(pendingRole, createdCode);
  });

  document.getElementById('joinPairBtn').addEventListener('click', () => showStep(stepJoinCode));

  document.getElementById('joinConfirmBtn').addEventListener('click', async () => {
    const input = document.getElementById('joinCodeInput');
    const errorEl = document.getElementById('joinError');
    const code = input.value.trim().toUpperCase();
    errorEl.textContent = '';
    if (!code) {
      errorEl.textContent = 'Masukkan kode dulu ya';
      return;
    }
    if (!isFirebaseReady) {
      errorEl.textContent = 'Koneksi ke server belum siap, cek firebaseConfig';
      return;
    }
    try {
      const snap = await getDoc(doc(db, COUPLES_COLLECTION, code));
      if (!snap.exists()) {
        errorEl.textContent = 'Kode tidak ditemukan, cek lagi ya';
        return;
      }
      bootApp(pendingRole, code);
    } catch (err) {
      console.error(err);
      errorEl.textContent = 'Gagal terhubung, coba lagi';
    }
  });

  document.getElementById('switchRoleBtn').addEventListener('click', () => {
    if (!confirm('Keluar dari pasangan ini di device ini?')) return;
    clearSession();
    location.reload();
  });

  function bootApp(role, coupleCode) {
    saveSession({ role, coupleCode });
    docRef = doc(db, COUPLES_COLLECTION, coupleCode);
    onboardOverlay.style.display = 'none';
    appRoot.style.display = 'block';
    renderGreeting(role);
    showViewForRole(role);
    renderAll();
    startSync();
    setupNotifications();
  }

  // ============================================================
  // BOOT
  // ============================================================
  session = loadSession();
  if (session && session.role && session.coupleCode && isFirebaseReady) {
    bootApp(session.role, session.coupleCode);
  } else if (session && session.role && session.coupleCode && !isFirebaseReady) {
    // Firebase belum siap tapi session ada — tetap coba tampilkan UI
    appRoot.style.display = 'block';
    onboardOverlay.style.display = 'none';
    renderGreeting(session.role);
    showViewForRole(session.role);
    renderAll();
  }
