(() => {
  /* ---------- assemble content: quiz bank + revision pack ---------- */
  const TOPICS = window.TOPICS.map((t) => ({ title: t.title, questions: t.questions.slice() }));
  const META = window.TOPIC_META.slice();
  window.PACK_NEW_TOPICS.forEach((t) => { TOPICS.push({ title: t.title, questions: [] }); META.push(t.meta); });
  const topicIndex = (title) => {
    const i = TOPICS.findIndex((t) => t.title === title);
    if (i === -1) throw new Error(`Unknown topic: ${title}`);
    return i;
  };
  Object.entries(window.PACK_QUESTIONS).forEach(([title, rows]) => {
    const t = TOPICS[topicIndex(title)];
    rows.forEach(([section, q, options, explanation, mock]) => t.questions.push({ section, q, options, answer: 0, explanation, mock, pack: true }));
  });
  const glossaryMap = new Map();
  [...window.GLOSSARY, ...window.PACK_GLOSSARY].forEach(([term, def, title]) => glossaryMap.set(term.toLowerCase(), [term, def, topicIndex(title)]));
  const GLOSSARY = [...glossaryMap.values()];
  const DIAGRAMS = window.DIAGRAMS.map((d) => ({ ...d, topic: topicIndex(d.topic) }));
  // Unit descriptor: tag every revision-pack question with an assessment criterion, then add the exam-style questions.
  const PACK_SECTION_AC = {
    'Levels of Organisation': '1.1', 'Specialised Cells': '1.2', 'Tissue Types': '1.3',
    'Skeleton & Joints': '1.4', 'Muscle': '1.4', 'Brain Regions': '1.4', 'Neurons': '1.4', 'Divisions': '3.2',
    'Blood Vessels': '1.5', 'Heart Valves': '1.5', 'Pulmonary Circuit': '1.5', 'Airways & Alveoli': '1.5', 'Breathing Muscles': '1.5',
    'Digestive Tract': '3.1', 'Biliary System': '1.7', 'Urinary Organs': '1.6', 'Nephron': '1.6', 'Glands & Hormones': '3.2',
    'Lymphoid Organs': '2.3', 'Lymphatic Disorders': '2.3', 'Ear': '3.3', 'Eye': '3.3', 'Female Structures': '3.2', 'Male Structures': '3.2',
    'Layers of the Skin': '3.4', 'Skin Cells & Receptors': '3.5', 'Skin Appendages': '3.5',
    'Digestion + Cardiovascular': '2.4', 'Respiratory + Cardiovascular': '2.4', 'Voluntary Movement': '2.4', 'Interdependence': '2.4',
  };
  TOPICS.forEach((t) => t.questions.forEach((q) => { if (q.pack) q.ac = PACK_SECTION_AC[q.section]; }));
  window.AC_QUESTIONS.forEach(([ac, title, section, q, options, explanation]) => TOPICS[topicIndex(title)].questions.push({ section, q, options, answer: 0, explanation, ac, pack: true }));
  const CRITERIA = window.CRITERIA;
  const acRefs = (code) => TOPICS.flatMap((t, ti) => t.questions.map((q, qi) => [ti, qi, q.ac])).filter((r) => r[2] === code).map(([ti, qi]) => [ti, qi]);
  const QUICK = {};
  [window.QUICK_CHECKS, window.AC_QUICK].forEach((src) => Object.entries(src).forEach(([title, rows]) => { const ti = topicIndex(title); QUICK[ti] = [...(QUICK[ti] || []), ...rows]; }));
  const PACK_WRITTEN_AC = ['1.1', '1.5', '1.4', '1.7', '2.3', '1.5', '3.4', '3.2', '1.5', '1.5', '3.1', '3.4', '1.7', '1.2', '3.4', '2.3', '3.3', '2.4'];
  const WRITTEN = [
    ...window.WRITTEN.map((w, i) => ({ ...w, ac: PACK_WRITTEN_AC[i], src: w.model ? 'pack' : 'suggested' })),
    ...window.AC_WRITTEN.map((w) => ({ ...w, src: 'exam' })),
  ];
  const CASES = window.CASE_STUDIES;
  const MOCK_REFS = TOPICS.flatMap((t, ti) => t.questions.map((q, qi) => [ti, qi, q.mock])).filter((r) => r[2]).sort((a, b) => a[2] - b[2]).map(([ti, qi]) => [ti, qi]);
  const app = document.getElementById('app');
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const DAILY_GOAL = 20;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const qid = (ti, qi) => `${ti}-${qi}`;
  const topicStyle = (ti) => `--tc:${META[ti].tc};--ti:${META[ti].ti}`;

  /* ---------- saved progress ---------- */
  const KEY = 'healthpractice:v1';
  const blank = () => ({ stats: {}, mistakes: [], xp: 0, badges: [], streak: { last: null, count: 0, best: 0 }, today: { d: null, n: 0 }, mended: 0, quizzes: 0, perfects: 0, cards: 0, diag: {}, written: {}, theme: 'auto' });
  let S = blank();
  try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = blank(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } };
  // Ask the browser to keep this app's saved progress even when the phone is low on space.
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* not supported */ }

  const dayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayStr(d); };
  const touchDay = () => {
    const t = dayStr();
    if (S.today.d !== t) S.today = { d: t, n: 0 };
    if (S.streak.last !== t) {
      S.streak.count = S.streak.last === yesterday() ? S.streak.count + 1 : 1;
      S.streak.last = t;
      S.streak.best = Math.max(S.streak.best, S.streak.count);
    }
  };
  const currentStreak = () => (S.streak.last === dayStr() || S.streak.last === yesterday() ? S.streak.count : 0);
  const todayCount = () => (S.today.d === dayStr() ? S.today.n : 0);
  const totalAnswered = () => Object.values(S.stats).reduce((n, s) => n + s.c + s.w, 0);

  const mastery = (ti) => {
    const qs = TOPICS[ti].questions;
    let right = 0, seen = 0;
    qs.forEach((_, qi) => { const s = S.stats[qid(ti, qi)]; if (s) { seen++; if (s.l === 1) right++; } });
    return { pct: Math.round((right / qs.length) * 100), seen, total: qs.length };
  };

  const applyTheme = () => {
    if (S.theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', S.theme);
  };
  applyTheme();

  /* ---------- badges ---------- */
  const BADGES = [
    { id: 'first', e: '🐣', name: 'First Steps', desc: 'Finish your first quiz', test: () => S.quizzes >= 1 },
    { id: 'perfect', e: '🌟', name: 'Flawless', desc: '100% on a quiz of 10+', test: () => S.perfects >= 1 },
    { id: 'q100', e: '💯', name: 'Century', desc: 'Answer 100 questions', test: () => totalAnswered() >= 100 },
    { id: 'q500', e: '🤖', name: 'Question Machine', desc: 'Answer 500 questions', test: () => totalAnswered() >= 500 },
    { id: 's3', e: '🔥', name: 'On a Roll', desc: '3-day streak', test: () => S.streak.best >= 3 },
    { id: 's7', e: '🗓️', name: 'Week Warrior', desc: '7-day streak', test: () => S.streak.best >= 7 },
    { id: 'mend', e: '🩹', name: 'Mistake Mender', desc: 'Fix 10 mistakes', test: () => S.mended >= 10 },
    { id: 'cards', e: '🃏', name: 'Card Shark', desc: 'Flip through 50 flashcards', test: () => S.cards >= 50 },
    { id: 'label', e: '🏷️', name: 'Label Legend', desc: 'Perfect score on a diagram', test: () => DIAGRAMS.some((d) => S.diag[d.id] === d.labels.length) },
    { id: 'map', e: '🗺️', name: 'Body Mapper', desc: 'Perfect on every diagram', test: () => DIAGRAMS.every((d) => S.diag[d.id] === d.labels.length) },
    ...TOPICS.map((t, ti) => ({ id: `t${ti}`, e: META[ti].emoji, name: META[ti].badge, desc: `80% mastery: ${t.title}`, test: () => mastery(ti).pct >= 80 })),
    { id: 'all', e: '👑', name: 'A&P Royalty', desc: '80% mastery on all 12 topics', test: () => TOPICS.every((_, ti) => mastery(ti).pct >= 80) },
  ];
  const checkBadges = () => {
    const fresh = BADGES.filter((b) => !S.badges.includes(b.id) && b.test());
    fresh.forEach((b) => S.badges.push(b.id));
    if (fresh.length) { save(); fresh.forEach((b, i) => setTimeout(() => toast(b.e, `New badge: ${b.name}!`), i * 2600)); }
  };

  /* ---------- mascot ---------- */
  const pip = (mood = 'happy', size = 76) => `
    <svg class="pip ${mood}" width="${size}" height="${size * 0.96}" viewBox="0 0 100 96" aria-hidden="true">
      <path d="M50 90 C20 68 5 50 5 32 C5 17 17 6 31 6 C40 6 46 11 50 18 C54 11 60 6 69 6 C83 6 95 17 95 32 C95 50 80 68 50 90Z" fill="#ff8fbf" stroke="#e5629d" stroke-width="3"/>
      <ellipse cx="34" cy="22" rx="9" ry="5" fill="#fff" opacity=".45" transform="rotate(-25 34 22)"/>
      <ellipse cx="26" cy="54" rx="7" ry="4.5" fill="#ff5f9e" opacity=".55"/><ellipse cx="74" cy="54" rx="7" ry="4.5" fill="#ff5f9e" opacity=".55"/>
      <g class="m m-happy m-think m-sad"><circle cx="36" cy="42" r="5.5" fill="#3d2c4e"/><circle cx="64" cy="42" r="5.5" fill="#3d2c4e"/><circle cx="38" cy="40" r="1.8" fill="#fff"/><circle cx="66" cy="40" r="1.8" fill="#fff"/></g>
      <g class="m m-yay" fill="none" stroke="#3d2c4e" stroke-width="3.5" stroke-linecap="round"><path d="M30 43 Q36 35 42 43"/><path d="M58 43 Q64 35 70 43"/></g>
      <path class="m m-happy" d="M42 54 Q50 62 58 54" fill="none" stroke="#3d2c4e" stroke-width="3.5" stroke-linecap="round"/>
      <path class="m m-yay" d="M40 52 Q50 68 60 52Z" fill="#3d2c4e"/>
      <path class="m m-sad" d="M42 60 Q50 53 58 60" fill="none" stroke="#3d2c4e" stroke-width="3.5" stroke-linecap="round"/>
      <circle class="m m-think" cx="50" cy="57" r="4" fill="#3d2c4e"/>
    </svg>`;
  const CHEERS = ['Yay! You nailed it! 💖', 'Brainy and beautiful! ✨', 'Correct! Your neurones are firing! ⚡', 'Woohoo! 🎉', 'Spot on! 🌟', 'Heart-eyes for that answer 😍'];
  const OOPS = ['Oops! Have a read below 💕', 'Not quite, you\'ve got this! 🌱', 'Almost! Let\'s learn this one 📖', 'Mistakes help us grow 🌸'];

  /* ---------- toast + confetti ---------- */
  let toastTimer;
  const toast = (emoji, text) => {
    const el = document.getElementById('toast');
    el.innerHTML = `<span class="e">${emoji}</span><span>${esc(text)}</span>`;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  };
  const confetti = () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#ff8fbf', '#a98bff', '#5cc9a0', '#ffc94d', '#7cc4ff'];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = `${Math.random() * 100}vw`;
      c.style.background = pick(colors);
      c.style.animationDuration = `${1.6 + Math.random() * 1.6}s`;
      c.style.animationDelay = `${Math.random() * 0.4}s`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 3800);
    }
  };

  /* ---------- recording answers ---------- */
  const record = (ti, qi, ok) => {
    touchDay();
    S.today.n++;
    const id = qid(ti, qi);
    const s = S.stats[id] || { c: 0, w: 0, l: 0 };
    if (ok) s.c++; else s.w++;
    s.l = ok ? 1 : 0;
    S.stats[id] = s;
    S.xp += ok ? 10 : 2;
    const inBox = S.mistakes.indexOf(id);
    if (!ok && inBox === -1) S.mistakes.push(id);
    if (ok && inBox !== -1) { S.mistakes.splice(inBox, 1); S.mended++; }
    save();
  };

  /* ---------- quiz session ---------- */
  let Q = null;
  const startQuiz = (refs, title, back, limit, ordered) => {
    if (!refs.length) { toast('🌈', 'Nothing to quiz here yet!'); return; }
    let items = ordered ? refs.slice() : shuffle(refs);
    if (limit) items = items.slice(0, limit);
    Q = { title, back, i: 0, picked: null, right: 0, wrong: [], items: items.map(([ti, qi]) => ({ ti, qi, order: shuffle(TOPICS[ti].questions[qi].options.map((_, k) => k)) })) };
    go('#/quiz');
  };
  const allRefs = (ti) => TOPICS[ti].questions.map((_, qi) => [ti, qi]);
  const sectionRefs = (ti, sec) => allRefs(ti).filter(([, qi]) => TOPICS[ti].questions[qi].section === sec);
  const everyRef = () => TOPICS.flatMap((_, ti) => allRefs(ti));
  const mistakeRefs = (ti) => S.mistakes.map((id) => id.split('-').map(Number)).filter(([t]) => ti === undefined || t === ti);

  const answer = (k) => {
    if (!Q || Q.picked !== null) return;
    const it = Q.items[Q.i];
    const q = TOPICS[it.ti].questions[it.qi];
    Q.picked = k;
    const ok = it.order[k] === q.answer;
    if (ok) Q.right++; else Q.wrong.push(it);
    record(it.ti, it.qi, ok);
    render();
  };
  const nextQ = () => {
    if (!Q) return;
    Q.i++;
    Q.picked = null;
    if (Q.i >= Q.items.length) {
      S.quizzes++;
      if (Q.right === Q.items.length && Q.items.length >= 10) S.perfects++;
      if (Q.isMock) S.mockBest = Math.max(S.mockBest || 0, Q.right);
      save();
      checkBadges();
    }
    render();
    window.scrollTo({ top: 0 });
  };

  /* ---------- flashcards session ---------- */
  let C = null;
  const startCards = (refs, title, back) => {
    if (!refs.length) return;
    C = { title, back, i: 0, flipped: false, known: 0, again: 0, items: shuffle(refs) };
    go('#/cards');
  };
  const cardMark = (knew) => {
    if (!C) return;
    const item = C.items[C.i];
    if (knew) C.known++; else { C.again++; C.items.push(item); }
    S.cards++; save();
    C.i++;
    C.flipped = false;
    if (C.i >= C.items.length) checkBadges();
    render();
  };

  /* ---------- diagram session ---------- */
  let DG = null;
  const startDiagram = (id) => {
    const d = DIAGRAMS.find((x) => x.id === id);
    DG = { id, placed: {}, sel: null, selPin: null, checked: false, study: false, order: shuffle(d.labels.map((_, i) => i)) };
  };

  /* ---------- routing ---------- */
  const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
  const route = () => (location.hash.replace(/^#\/?/, '') || 'home').split('/');

  const render = () => {
    const [view, a, b] = route();
    const focus = ['quiz', 'cards'].includes(view);
    document.body.classList.toggle('focus', focus);
    const navKey = { topic: 'topics', diagram: 'diagrams', mistakes: 'home', exam: 'exam', written: 'exam', cases: 'exam', outcomes: 'exam' }[view] || view;
    document.querySelectorAll('[data-nav]').forEach((n) => n.classList.toggle('on', n.dataset.nav === navKey));
    const views = { home, topics, topic, quiz, cards, diagrams, diagram, glossary, me, mistakes, exam, written, cases, outcomes };
    app.innerHTML = (views[view] || home)(a, b);
    afterRender(view);
  };
  window.addEventListener('hashchange', () => { render(); window.scrollTo({ top: 0 }); });

  const topBar = (title, back, extra = '') => `
    <div class="top"><button class="back" data-go="${back}" aria-label="Back">‹</button><h1 class="grow" style="font-size:1.3rem">${title}</h1>${extra}</div>`;

  /* ---------- views ---------- */
  function home() {
    const h = new Date().getHours();
    const hi = h < 12 ? 'Good morning! ☀️' : h < 18 ? 'Good afternoon! 🌼' : 'Good evening! 🌙';
    const n = Number(dayStr().replace(/-/g, ''));
    const ti = n % TOPICS.length;
    const q = TOPICS[ti].questions[(n * 7) % TOPICS[ti].questions.length];
    const done = todayCount();
    const pct = Math.min(100, Math.round((done / DAILY_GOAL) * 100));
    return `
      <section class="hero">
        ${pip(done >= DAILY_GOAL ? 'yay' : 'happy', 84)}
        <div class="grow">
          <h1>${hi}</h1>
          <div class="bubble" style="margin-top:8px"><span class="pill" style="margin-bottom:4px">${META[ti].emoji} Fact of the day</span><br>${esc(q.explanation)}</div>
        </div>
      </section>
      <div class="stats">
        <div class="stat"><b>🔥 ${currentStreak()}</b><span>day streak</span></div>
        <div class="stat"><b>⭐ ${S.xp}</b><span>XP</span></div>
        <div class="stat"><b>${done}/${DAILY_GOAL}</b><span>today's goal</span><div class="bar" style="--ti:var(--pink);margin-top:6px;background:var(--surface2)"><i style="width:${pct}%"></i></div></div>
      </div>
      <div class="tiles">
        <button class="tile" data-act="quick"><div class="ic">⚡</div><h3>Quick 10</h3><p>Random mix from all topics</p></button>
        <button class="tile" data-go="#/mistakes"><div class="ic">💌</div><h3>Mistakes box</h3><p>${S.mistakes.length ? `${S.mistakes.length} to fix` : 'All clear!'}</p></button>
        <button class="tile" data-go="#/diagrams"><div class="ic">🏷️</div><h3>Label it</h3><p>${DIAGRAMS.length} diagrams to label</p></button>
        <button class="tile" data-go="#/exam"><div class="ic">📝</div><h3>Exam practice</h3><p>Mock test, written Qs, tips</p></button>
        <button class="tile" data-act="allcards"><div class="ic">🃏</div><h3>Flashcards</h3><p>Shuffle everything</p></button>
        <button class="tile" data-act="mock"><div class="ic">⏱️</div><h3>Mock test</h3><p>20 exam-style MCQs</p></button>
      </div>
      <h2>Your topics</h2>
      ${topicGrid()}`;
  }

  const topicGrid = () => `<div class="topics">${TOPICS.map((t, ti) => {
    const m = mastery(ti);
    return `<button class="tcard" style="${topicStyle(ti)}" data-go="#/topic/${ti}/learn">
      <span class="em">${META[ti].emoji}</span><h3>${esc(t.title)}</h3>
      <div class="meta">${m.pct}% mastered · ${m.total} Qs</div><div class="bar"><i style="width:${m.pct}%"></i></div></button>`;
  }).join('')}</div>`;

  function topics() {
    return `<h1 style="margin:6px 4px 14px">📚 Topics</h1>${topicGrid()}`;
  }

  const sectionsOf = (ti) => {
    const map = new Map();
    TOPICS[ti].questions.forEach((q, qi) => { if (!map.has(q.section)) map.set(q.section, []); map.get(q.section).push(qi); });
    return [...map.entries()];
  };

  function topic(a, tab = 'learn') {
    const ti = Number(a);
    if (!TOPICS[ti]) return home();
    const t = TOPICS[ti];
    const m = mastery(ti);
    const secs = sectionsOf(ti);
    const tabs = [['learn', '📖 Learn'], ['quiz', '✏️ Quiz'], ['cards', '🃏 Cards']];
    let body = '';
    if (tab === 'learn') {
      body = secs.map(([sec, qis], i) => `
        <details class="card sec" ${i === 0 ? 'open' : ''}>
          <summary><span class="pill">${qis.length}</span>${esc(sec)}<span class="chev">›</span></summary>
          <ul class="facts">${[...new Set(qis.map((qi) => t.questions[qi].explanation))].map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
          <button class="btn soft block" style="margin-top:10px" data-act="secquiz" data-ti="${ti}" data-sec="${esc(sec)}">Quiz me on this ✏️</button>
        </details>`).join('') + (QUICK[ti] ? `
        <div class="card sec"><h3>✏️ Quick check — test yourself</h3><p class="small muted">Answer in your head, then check.</p>
          <div class="list" style="margin-top:12px">${QUICK[ti].map(([q, ans], k) => `<div style="padding:12px;border-radius:14px;background:var(--surface2)"><p style="font-weight:800;margin-bottom:8px">${k + 1}. ${esc(q)}</p>${revealBtn(`q${ti}-${k}`)}${opened.has(`q${ti}-${k}`) ? `<p class="small" style="margin-top:8px">${esc(ans)}</p>` : ''}</div>`).join('')}</div></div>` : '');
    } else if (tab === 'quiz') {
      const weak = allRefs(ti).filter(([t2, qi]) => (S.stats[qid(t2, qi)] || {}).l !== 1);
      body = `
        <div class="list">
          <button class="li" data-act="tquiz" data-ti="${ti}" data-limit="10"><span class="ic">⚡</span><span class="grow"><b>Quick 10</b><br><span class="small muted">10 random questions</span></span>›</button>
          <button class="li" data-act="tquiz" data-ti="${ti}"><span class="ic">🎯</span><span class="grow"><b>Whole topic</b><br><span class="small muted">All ${t.questions.length} questions</span></span>›</button>
          <button class="li" data-act="weak" data-ti="${ti}"><span class="ic">🌱</span><span class="grow"><b>Not mastered yet</b><br><span class="small muted">${weak.length} question${weak.length === 1 ? '' : 's'} left</span></span>›</button>
          ${mistakeRefs(ti).length ? `<button class="li" data-act="tmist" data-ti="${ti}"><span class="ic">💌</span><span class="grow"><b>My mistakes</b><br><span class="small muted">${mistakeRefs(ti).length} to fix</span></span>›</button>` : ''}
        </div>
        <h2>By section</h2>
        <div class="list">${secs.map(([sec, qis]) => {
          const got = qis.filter((qi) => (S.stats[qid(ti, qi)] || {}).l === 1).length;
          return `<button class="li" data-act="secquiz" data-ti="${ti}" data-sec="${esc(sec)}"><span class="grow"><b>${esc(sec)}</b><br><span class="small muted">${got}/${qis.length} mastered</span></span>›</button>`;
        }).join('')}</div>`;
    } else {
      body = `
        <div class="list">
          <button class="li" data-act="tcards" data-ti="${ti}"><span class="ic">🃏</span><span class="grow"><b>All cards</b><br><span class="small muted">${t.questions.length} cards</span></span>›</button>
          ${secs.map(([sec, qis]) => `<button class="li" data-act="seccards" data-ti="${ti}" data-sec="${esc(sec)}"><span class="grow"><b>${esc(sec)}</b><br><span class="small muted">${qis.length} cards</span></span>›</button>`).join('')}
        </div>`;
    }
    return `
      ${topBar('', '#/topics')}
      <section class="thead" style="${topicStyle(ti)}">
        <span class="em">${META[ti].emoji}</span>
        <div class="grow"><h1 style="font-size:1.35rem">${esc(t.title)}</h1>
          <div class="small" style="font-weight:800;opacity:.8">${m.pct}% mastered · ${m.seen}/${m.total} attempted</div>
          <div class="bar" style="margin-top:6px"><i style="width:${m.pct}%"></i></div></div>
      </section>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-go="#/topic/${ti}/${k}">${l}</button>`).join('')}</div>
      ${body}
      ${m.seen ? `<div class="card center" style="margin-top:18px">
        <p class="small muted">Want to start this topic again from scratch?</p>
        <button class="btn soft" style="margin-top:10px" data-act="resettopic" data-ti="${ti}">↺ Reset progress for this topic</button>
      </div>` : ''}`;
  }

  function quiz() {
    if (!Q) return home();
    const total = Q.items.length;
    if (Q.i >= total) return quizEnd();
    const it = Q.items[Q.i];
    const q = TOPICS[it.ti].questions[it.qi];
    const answered = Q.picked !== null;
    const ok = answered && it.order[Q.picked] === q.answer;
    return `
      <div class="qtop">
        <button class="back" data-act="quitquiz" aria-label="Quit quiz">✕</button>
        <div class="prog"><i style="width:${(Q.i / total) * 100}%"></i></div>
        <span class="qcount">${Q.i + 1}/${total}</span>
      </div>
      <div class="card" style="${topicStyle(it.ti)}">
        <div class="row"><span class="pill">${META[it.ti].emoji} ${esc(q.section)}</span></div>
        <p class="qtext">${esc(q.q)}</p>
        <div class="opts">${it.order.map((orig, k) => {
          let cls = '';
          if (answered) { if (orig === q.answer) cls = 'right'; else if (k === Q.picked) cls = 'wrong'; else cls = 'dim'; }
          return `<button class="opt ${cls}" data-ans="${k}" ${answered ? 'aria-disabled="true"' : ''}><span class="k">${LETTERS[k]}</span><span>${esc(q.options[orig])}</span></button>`;
        }).join('')}</div>
        ${answered ? `<div class="explain">${pip(ok ? 'yay' : 'sad', 54)}<div><b>${ok ? pick(CHEERS) : pick(OOPS)}</b><p class="small" style="margin-top:4px">${esc(q.explanation)}</p></div></div>` : ''}
      </div>
      ${answered ? `<div class="foot"><button class="btn block" data-act="next">${Q.i + 1 === total ? 'See results 🎀' : 'Next →'}</button></div>` : ''}`;
  }

  function quizEnd() {
    const total = Q.items.length;
    const pct = Math.round((Q.right / total) * 100);
    const mood = pct >= 80 ? 'yay' : pct >= 50 ? 'happy' : 'think';
    const msg = pct === 100 ? 'PERFECT! You\'re a superstar! 🌟' : pct >= 80 ? 'Amazing work! 💖' : pct >= 50 ? 'Nice going! Keep practising 🌱' : 'Every expert started here. Try again! 🌸';
    if (pct >= 80) setTimeout(confetti, 150);
    return `
      <div class="card center" style="margin-top:10px">
        <div style="display:flex;justify-content:center">${pip(mood, 96)}</div>
        <h1 style="margin-top:8px">${msg}</h1>
        <p class="muted small" style="margin:4px 0 16px">${esc(Q.title)}</p>
        <div class="ring" style="--p:${pct}"><div>${pct}%</div></div>
        <p style="margin-top:12px;font-weight:800">${Q.right} of ${total} correct · +${Q.right * 10 + (total - Q.right) * 2} XP</p>
        <div class="seg" style="justify-content:center;margin-top:16px">
          ${Q.wrong.length ? '<button class="btn" data-act="retrywrong">Retry wrong ones 🔁</button>' : ''}
          <button class="btn soft" data-act="donequiz">Done</button>
        </div>
      </div>
      ${Q.wrong.length ? `<h2>Review 📝</h2><div class="list">${Q.wrong.map((it) => {
        const q = TOPICS[it.ti].questions[it.qi];
        return `<div class="card"><p style="font-weight:800">${esc(q.q)}</p><p style="margin-top:6px;color:var(--mint);font-weight:800">✓ ${esc(q.options[q.answer])}</p><p class="small muted" style="margin-top:4px">${esc(q.explanation)}</p></div>`;
      }).join('')}</div>` : ''}`;
  }

  function cards() {
    if (!C) return home();
    if (C.i >= C.items.length) {
      setTimeout(confetti, 150);
      return `<div class="card center" style="margin-top:10px">
        <div style="display:flex;justify-content:center">${pip('yay', 96)}</div>
        <h1 style="margin-top:8px">Deck complete! 🎉</h1>
        <p class="muted" style="margin:6px 0 16px">${C.known} known · ${C.again} repeats</p>
        <button class="btn" data-act="donecards">Done</button></div>`;
    }
    const [ti, qi] = C.items[C.i];
    const q = TOPICS[ti].questions[qi];
    return `
      <div class="qtop">
        <button class="back" data-act="quitcards" aria-label="Close flashcards">✕</button>
        <div class="prog"><i style="width:${(C.i / C.items.length) * 100}%"></i></div>
        <span class="qcount">${C.i + 1}/${C.items.length}</span>
      </div>
      <div class="flip ${C.flipped ? 'on' : ''}" data-act="flip" role="button" tabindex="0" aria-label="Flip card" style="${topicStyle(ti)}">
        <div class="flip-in">
          <div class="face f-front"><span class="pill">${META[ti].emoji} ${esc(q.section)}</span><p class="q">${esc(q.q)}</p><p class="tap">tap to flip ↻</p></div>
          <div class="face f-back"><span class="pill">Answer</span><p class="a">${esc(q.options[q.answer])}</p><p class="small muted">${esc(q.explanation)}</p></div>
        </div>
      </div>
      <div id="cardbtns">${cardButtons()}</div>`;
  }
  const cardButtons = () => (C.flipped
    ? '<div class="row"><button class="btn soft grow" data-act="again">😅 Again</button><button class="btn mint grow" data-act="knew">😊 Got it</button></div>'
    : '<button class="btn block" data-act="flip">Show answer</button>');
  // Flip in place (no re-render) so the 3D turn animates.
  const flipCard = () => {
    C.flipped = !C.flipped;
    const card = document.querySelector('.flip');
    const btns = document.getElementById('cardbtns');
    if (!card || !btns) { render(); return; }
    card.classList.toggle('on', C.flipped);
    btns.innerHTML = cardButtons();
  };

  function mistakes() {
    const n = S.mistakes.length;
    if (!n) {
      return `${topBar('💌 Mistakes box', '#/home')}<div class="card empty">${pip('yay', 90)}<h2>All clear!</h2><p class="muted">Questions you get wrong will wait here until you get them right.</p></div>`;
    }
    const byTopic = TOPICS.map((t, ti) => [ti, mistakeRefs(ti).length]).filter(([, c]) => c);
    return `${topBar('💌 Mistakes box', '#/home')}
      <div class="card row">${pip('think', 64)}<p class="grow"><b>${n} question${n === 1 ? '' : 's'} to fix.</b><br><span class="small muted">Get one right and it leaves the box.</span></p></div>
      <button class="btn block" style="margin:14px 0" data-act="allmist">Fix them all 💪</button>
      <div class="list">${byTopic.map(([ti, c]) => `<button class="li" data-act="tmist" data-ti="${ti}"><span class="ic">${META[ti].emoji}</span><span class="grow"><b>${esc(TOPICS[ti].title)}</b><br><span class="small muted">${c} to fix</span></span>›</button>`).join('')}</div>`;
  }

  function diagrams() {
    return `<h1 style="margin:6px 4px 6px">🏷️ Label it!</h1><p class="muted" style="margin:0 4px 14px">Tap a label, then tap the numbered bubble it belongs to.</p>
      <div class="list">${DIAGRAMS.map((d) => {
        const best = S.diag[d.id];
        return `<button class="li" data-go="#/diagram/${d.id}" style="${topicStyle(d.topic)}"><span class="ic" style="font-size:2rem">${d.emoji}</span><span class="grow"><b>${d.title}</b><br><span class="small muted">${d.labels.length} labels · ${best === undefined ? 'not tried yet' : `best ${best}/${d.labels.length}`}${best === d.labels.length ? ' 🏆' : ''}</span></span>›</button>`;
      }).join('')}</div>`;
  }

  const isRight = (d, p) => DG.placed[p] !== undefined && d.labels[DG.placed[p]][0] === d.labels[p][0];
  // Widen dense diagrams so the number bubbles (≈26px) never overlap; the frame scrolls sideways.
  const diagramMinWidth = (d) => {
    const bubbleX = ([, x, , w, h, , al]) => (al === 'l' ? x + h / 2 : al === 'r' ? x + w - h / 2 : x + w / 2);
    const centres = d.labels.map((l) => [bubbleX(l), l[2] + l[4] / 2]);
    let min = Infinity;
    centres.forEach(([x1, y1], i) => centres.slice(i + 1).forEach(([x2, y2]) => { min = Math.min(min, Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2))); }));
    return Math.min(1100, Math.round((d.w * 28) / min));
  };

  function diagram(id) {
    const d = DIAGRAMS.find((x) => x.id === id);
    if (!d) return diagrams();
    if (!DG || DG.id !== id) startDiagram(id);
    const n = d.labels.length;
    const score = d.labels.filter((_, p) => isRight(d, p)).length;
    const labelAt = {};
    Object.entries(DG.placed).forEach(([p, l]) => { labelAt[l] = Number(p); });
    const pct = (v, of) => `${(v / of) * 100}%`;
    const masks = d.labels.map(([, x, y, w, h, , al], p) => {
      let cls = '';
      if (DG.study) cls = 'reveal';
      else if (DG.checked) cls = isRight(d, p) ? 'ok' : 'bad';
      else if (DG.selPin === p) cls = 'sel';
      else if (DG.placed[p] !== undefined) cls = 'filled';
      return `<button class="mask ${cls} ${al ? `al-${al}` : ''}" style="left:${pct(x, d.w)};top:${pct(y, d.h)};width:${pct(w, d.w)};height:${pct(h, d.h)}" data-pin="${p}" aria-label="Box ${p + 1}"><span class="bub">${p + 1}</span></button>`;
    }).join('');
    const chips = DG.order.map((l) => {
      const at = labelAt[l];
      let cls = '';
      if (DG.checked) cls = at === undefined ? '' : isRight(d, at) ? 'ok' : 'bad';
      else if (DG.sel === l) cls = 'on';
      return `<button class="chip ${cls}" data-label="${l}">${at !== undefined ? `<span class="n">${at + 1}</span>` : ''}${esc(d.labels[l][0])}</button>`;
    }).join('');
    const allPlaced = Object.keys(DG.placed).length === n;
    const reveal = DG.checked || DG.study;
    return `${topBar(`${d.emoji} ${d.title}`, '#/diagrams')}
      <p class="small muted" style="margin:-6px 4px 10px">${esc(d.hint)} ${DG.study ? '' : 'Tap a label, then tap its numbered box.'}</p>
      <div class="imgscroll"><div class="imgdia" style="min-width:${diagramMinWidth(d)}px;aspect-ratio:${d.w}/${d.h}"><img src="${d.img}" alt="${esc(d.title)} diagram" draggable="false">${masks}</div></div>
      <p class="small muted center" style="margin-top:6px">Created with <a href="https://biorender.com" target="_blank" rel="noopener" style="color:inherit">BioRender.com</a></p>
      <p class="small muted center" id="swipehint" hidden>↔ Swipe sideways to see the whole diagram</p>
      ${DG.study ? '' : `<div class="labels">${chips}</div>`}
      ${DG.checked ? `<div class="card row" style="margin:12px 0">${pip(score === n ? 'yay' : score >= n / 2 ? 'happy' : 'think', 60)}<p class="grow"><b class="big" style="font-size:1.8rem">${score}/${n}</b><br><span class="small muted">${score === n ? 'Perfect labelling! 🏆' : 'Green = correct, red = try again.'}</span></p></div>` : ''}
      <div class="seg" style="margin-top:6px">
        ${reveal
          ? '<button class="btn" data-act="dreset">Try again 🔁</button>'
          : `<button class="btn" data-act="dcheck" ${allPlaced ? '' : 'disabled'}>Check ✓</button><button class="btn soft" data-act="dclear">Clear</button>`}
        ${DG.study ? '' : '<button class="btn soft" data-act="dstudy">Study mode 👀</button>'}
      </div>
      ${reveal ? `<h2>What each part does</h2><div class="list">${d.labels.map(([name, , , , , fact], p) => `<div class="card term"><b>${p + 1}. ${esc(name)}</b> ${DG.checked && !DG.study ? (isRight(d, p) ? '✅' : `❌ <span class="small muted">you put ${esc(d.labels[DG.placed[p]][0])}</span>`) : ''}<p class="small muted">${esc(fact)}</p></div>`).join('')}</div>` : ''}`;
  }

  /* ---------- exam practice ---------- */
  const opened = new Set();
  const revealBtn = (key, label = 'Show answer') => `<button class="btn soft" style="min-height:38px;padding:8px 16px" data-act="toggle" data-key="${key}">${opened.has(key) ? 'Hide' : label}</button>`;

  function exam() {
    const done = WRITTEN.filter((_, i) => S.written[i] === 1).length;
    return `
      <section class="hero">${pip('think', 76)}<div class="grow"><h1>Exam practice</h1><p class="small" style="font-weight:800;opacity:.8">Mock test, written questions, case studies and exam tips</p></div></section>
      <div class="tiles">
        <button class="tile" data-act="mock"><div class="ic">📝</div><h3>Mock test</h3><p>Part 1: 20 MCQs${S.mockBest !== undefined ? ` · best ${S.mockBest}/20` : ''}</p></button>
        <button class="tile" data-go="#/written"><div class="ic">✍️</div><h3>Written Qs</h3><p>${WRITTEN.length} questions · ${done} got it</p></button>
        <button class="tile" data-go="#/outcomes"><div class="ic">🎯</div><h3>By criterion</h3><p>3 learning outcomes · ${CRITERIA.length} criteria</p></button>
        <button class="tile" data-go="#/cases"><div class="ic">🩺</div><h3>Case studies</h3><p>${CASES.length} exam-style cases</p></button>
      </div>
      <h2>Exam tips 💡</h2>
      <div class="list">${window.EXAM_TIPS.map((s) => `<div class="card"><h3>${s.e} ${esc(s.title)}</h3><ul class="facts">${s.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('')}</div>`;
  }

  const criterionRow = (c) => {
    const refs = acRefs(c.code);
    const got = refs.filter(([ti, qi]) => (S.stats[qid(ti, qi)] || {}).l === 1).length;
    const pct = refs.length ? Math.round((got / refs.length) * 100) : 0;
    const nWritten = WRITTEN.filter((w) => w.ac === c.code).length;
    return `<div style="padding:12px;border-radius:16px;background:var(--surface2)">
      <div class="row" style="gap:6px;flex-wrap:wrap"><span class="pill" style="background:var(--pink);color:#fff">AC ${c.code}</span><span class="pill">${c.type}</span><span class="grow"></span><span class="small" style="font-weight:800">${pct}% mastered</span></div>
      <p class="small" style="margin:8px 0;font-weight:700">${esc(c.text)}</p>
      <div class="bar" style="--ti:var(--pink);background:var(--surface)"><i style="width:${pct}%"></i></div>
      <div class="seg" style="margin-top:10px">
        <button class="chip" data-act="acquiz" data-ac="${c.code}">✏️ ${refs.length} MCQs</button>
        ${nWritten ? `<button class="chip" data-go="#/written/${c.code}">✍️ ${nWritten} written</button>` : ''}
        ${c.diagrams ? '<button class="chip" data-go="#/diagrams">🏷️ Label diagrams</button>' : ''}
      </div></div>`;
  };

  function outcomes() {
    return `${topBar('🎯 Learning outcomes', '#/exam')}
      <p class="small muted" style="margin:-4px 4px 14px">Everything is mapped to the ASPHY-406-1505 unit descriptor. K&U = Knowledge & Understanding · A&A = Application & Analysis · S&E = Synthesis & Evaluation.</p>
      ${window.OUTCOMES.map((o) => `<div class="card" style="margin-bottom:14px"><h3>LO${o.lo}</h3><p class="small muted" style="margin:4px 0 12px">${esc(o.title)}</p>
        <div class="list">${CRITERIA.filter((c) => c.lo === o.lo).map(criterionRow).join('')}</div></div>`).join('')}`;
  }

  function cases() {
    return `${topBar('🩺 Case studies', '#/exam')}
      <p class="small muted" style="margin:-4px 4px 14px">The unit is normally assessed through case studies. Read the scenario, answer each part on paper, then check.</p>
      <div class="list">${CASES.map((c, i) => `<div class="card">
        <div class="row" style="gap:6px;flex-wrap:wrap"><span style="font-size:1.6rem">${c.e}</span><h3 class="grow">${esc(c.title)}</h3>${c.acs.map((a) => `<span class="pill">AC ${a}</span>`).join('')}</div>
        <p class="small" style="margin:10px 0;padding:12px;border-radius:14px;background:var(--surface2)">${esc(c.scenario)}</p>
        <div class="list">${c.parts.map((p, k) => `<div><p style="font-weight:800;margin-bottom:6px">(${String.fromCharCode(97 + k)}) ${esc(p.q)} <span class="pill">${p.marks} mark${p.marks === 1 ? '' : 's'}</span></p>
          ${revealBtn(`c${i}-${k}`, 'Show model answer')}${opened.has(`c${i}-${k}`) ? `<p class="small explain" style="display:block">${esc(p.a)}</p>` : ''}</div>`).join('')}</div>
      </div>`).join('')}</div>`;
  }

  function written(filter) {
    const list = WRITTEN.map((w, i) => [w, i]).filter(([w]) => !filter || w.ac === filter);
    return `${topBar(filter ? `✍️ Written · AC ${filter}` : '✍️ Written practice', filter ? '#/outcomes' : '#/exam')}
      <p class="small muted" style="margin:-4px 4px 14px">Answer on paper first (≈1 minute per mark), then check. Marks = points: a 3-mark question needs 3 distinct points.</p>
      <div class="list">${list.map(([w, i]) => {
        const k = `w${i}`;
        const status = S.written[i] === 1 ? '✅' : S.written[i] === 0 ? '🔁' : '';
        return `<div class="card">
          <div class="row" style="flex-wrap:wrap;gap:6px"><span class="pill">Q${i + 1}</span><span class="pill">${w.marks} mark${w.marks === 1 ? '' : 's'}</span>${w.ac ? `<span class="pill">AC ${w.ac}</span>` : ''}<span class="pill">${w.src === 'pack' ? '📘 Model answer' : '💡 Suggested answer'}</span><span class="grow"></span>${status}</div>
          <p style="font-weight:800;margin:10px 0">${esc(w.q)}</p>
          ${w.hint ? (opened.has(`h${i}`) ? `<p class="small muted" style="margin-bottom:10px">Hint: ${esc(w.hint)}</p>` : `<button class="chip" style="margin-bottom:10px" data-act="toggle" data-key="h${i}">💭 Hint</button>`) : ''}
          ${revealBtn(k)}
          ${opened.has(k) ? `<div class="explain" style="display:block"><p class="small" style="white-space:pre-line">${esc(w.a)}</p>
            <div class="row" style="margin-top:12px"><button class="btn soft grow" data-act="wmark" data-i="${i}" data-v="0">🔁 Practise again</button><button class="btn mint grow" data-act="wmark" data-i="${i}" data-v="1">✅ Got it</button></div></div>` : ''}
        </div>`;
      }).join('')}</div>`;
  }

  let gq = '', gt = -1;
  const glossaryList = () => {
    const needle = gq.trim().toLowerCase();
    const rows = GLOSSARY.filter(([term, def, ti]) => (gt === -1 || ti === gt) && (!needle || term.toLowerCase().includes(needle) || def.toLowerCase().includes(needle)))
      .sort((x, y) => x[0].localeCompare(y[0]));
    if (!rows.length) return `<div class="card empty">${pip('think', 70)}<p class="muted" style="margin-top:8px">No terms match "${esc(gq)}"</p></div>`;
    return `<p class="small muted" style="margin:0 4px 8px">${rows.length} term${rows.length === 1 ? '' : 's'}</p><div class="list">${rows.map(([term, def, ti]) => `<div class="card term"><div class="row"><b class="grow">${esc(term)}</b><span class="pill">${META[ti].emoji}</span></div><p class="small" style="margin-top:4px">${esc(def)}</p></div>`).join('')}</div>`;
  };
  function glossary() {
    return `<h1 style="margin:6px 4px 14px">📖 Glossary</h1>
      <div class="sw"><input class="search" id="gsearch" type="search" placeholder="Search terms…" value="${esc(gq)}" aria-label="Search glossary"></div>
      <div class="hscroll" role="group" aria-label="Filter by topic">
        <button class="chip ${gt === -1 ? 'on' : ''}" data-gt="-1">All</button>
        ${TOPICS.map((t, ti) => `<button class="chip ${gt === ti ? 'on' : ''}" data-gt="${ti}">${META[ti].emoji} ${esc(t.title.split(/ [&]| System/)[0])}</button>`).join('')}
      </div>
      <div id="glist">${glossaryList()}</div>`;
  }

  function me() {
    const answered = totalAnswered();
    const correct = Object.values(S.stats).reduce((n, s) => n + s.c, 0);
    const acc = answered ? Math.round((correct / answered) * 100) : 0;
    const earned = BADGES.filter((b) => S.badges.includes(b.id)).length;
    return `
      <section class="hero">${pip('happy', 76)}<div class="grow"><h1>My progress</h1><p class="small" style="font-weight:800;opacity:.8">${earned}/${BADGES.length} badges · best streak ${S.streak.best} 🔥</p></div></section>
      <div class="stats">
        <div class="stat"><b>${answered}</b><span>answered</span></div>
        <div class="stat"><b>${acc}%</b><span>accuracy</span></div>
        <div class="stat"><b>${S.quizzes}</b><span>quizzes</span></div>
      </div>
      <h2>Mastery</h2>
      <div class="card list" style="gap:12px">${TOPICS.map((t, ti) => {
        const m = mastery(ti);
        return `<div style="${topicStyle(ti)}"><div class="row small" style="font-weight:800"><span>${META[ti].emoji}</span><span class="grow">${esc(t.title)}</span><span>${m.pct}%</span></div><div class="bar" style="margin-top:4px;background:var(--surface2)"><i style="width:${m.pct}%"></i></div></div>`;
      }).join('')}</div>
      <h2>Badges</h2>
      <div class="badges">${BADGES.map((b) => `<div class="badge ${S.badges.includes(b.id) ? '' : 'locked'}"><div class="e">${b.e}</div><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`).join('')}</div>
      <h2>About & credits</h2>
      <div class="card small">
        <p><b>Health Practice App</b> — a free, non-commercial revision resource for MCAST students on ASPHY-406-1505 Anatomy for Health Practice.</p>
        <p style="margin-top:8px">Content prepared by Dr Brandon C. Seychell.</p>
        <p style="margin-top:8px">Scientific figures created with <a href="https://biorender.com" target="_blank" rel="noopener" style="color:var(--pink-ink)">BioRender.com</a>. BioRender figures remain the intellectual property of BioRender and are used here for educational purposes only; they may not be extracted, reused or redistributed.</p>
        <p style="margin-top:8px" class="muted">For revision only — always check your lecture notes and unit materials.</p>
      </div>
      <h2>Settings</h2>
      <div class="card">
        <p style="font-weight:800;margin-bottom:8px">Theme</p>
        <div class="seg">${[['auto', '🌗 Auto'], ['light', '☀️ Light'], ['dark', '🌙 Dark']].map(([k, l]) => `<button class="chip ${S.theme === k ? 'on' : ''}" data-theme-set="${k}">${l}</button>`).join('')}</div>
        <p style="font-weight:800;margin:16px 0 4px">Install on your phone 📱</p>
        <p class="small muted">iPhone: open in Safari → Share → <b>Add to Home Screen</b>.<br>Android: open in Chrome → ⋮ menu → <b>Install app</b>.<br>Works offline once installed.</p>
        <p style="font-weight:800;margin:16px 0 4px">Your progress 💾</p>
        <p class="small muted">Progress saves automatically on this phone. To redo one topic, open it and tap <b>Reset progress for this topic</b> at the bottom.</p>
        <button class="btn soft" style="margin-top:16px" data-act="reset">Reset all progress</button>
      </div>
      <p class="small muted center" style="margin-top:18px">ASPHY-406-1505 Anatomy for Health Practice</p>`;
  }

  /* ---------- events ---------- */
  const afterRender = (view) => {
    if (view === 'diagram') {
      const box = app.querySelector('.imgscroll');
      const hint = document.getElementById('swipehint');
      if (box && hint) hint.hidden = box.scrollWidth <= box.clientWidth + 2;
    }
    if (view === 'glossary') {
      const input = document.getElementById('gsearch');
      input.addEventListener('input', () => { gq = input.value; document.getElementById('glist').innerHTML = glossaryList(); });
    }
  };

  const assignLabel = (pin, label) => {
    Object.keys(DG.placed).forEach((p) => { if (DG.placed[p] === label) delete DG.placed[p]; });
    DG.placed[pin] = label;
    DG.sel = null;
    DG.selPin = null;
  };

  app.addEventListener('click', (e) => {
    const goEl = e.target.closest('[data-go]');
    if (goEl) { go(goEl.dataset.go); return; }

    const ans = e.target.closest('[data-ans]');
    if (ans) { answer(Number(ans.dataset.ans)); return; }

    const gtEl = e.target.closest('[data-gt]');
    if (gtEl) { gt = Number(gtEl.dataset.gt); render(); return; }

    const th = e.target.closest('[data-theme-set]');
    if (th) { S.theme = th.dataset.themeSet; save(); applyTheme(); render(); return; }

    const lab = e.target.closest('[data-label]');
    if (lab && DG && !DG.checked) {
      const l = Number(lab.dataset.label);
      if (DG.selPin !== null) assignLabel(DG.selPin, l);
      else DG.sel = DG.sel === l ? null : l;
      render(); return;
    }
    const pinEl = e.target.closest('[data-pin]');
    if (pinEl && DG && !DG.checked && !DG.study) {
      const p = Number(pinEl.dataset.pin);
      if (DG.sel !== null) assignLabel(p, DG.sel);
      else DG.selPin = DG.selPin === p ? null : p;
      render(); return;
    }

    const act = e.target.closest('[data-act]');
    if (!act) return;
    const ti = Number(act.dataset.ti);
    const sec = act.dataset.sec;
    const back = location.hash;
    switch (act.dataset.act) {
      case 'quick': startQuiz(everyRef(), 'Quick 10 · All topics', '#/home', 10); break;
      case 'allcards': startCards(everyRef(), 'All flashcards', '#/home'); break;
      case 'secquiz': startQuiz(sectionRefs(ti, sec), `${TOPICS[ti].title} · ${sec}`, back); break;
      case 'tquiz': startQuiz(allRefs(ti), TOPICS[ti].title, back, Number(act.dataset.limit) || 0); break;
      case 'weak': startQuiz(allRefs(ti).filter(([t2, qi]) => (S.stats[qid(t2, qi)] || {}).l !== 1), `${TOPICS[ti].title} · not mastered`, back); break;
      case 'tmist': startQuiz(mistakeRefs(ti), `${TOPICS[ti].title} · mistakes`, back); break;
      case 'allmist': startQuiz(mistakeRefs(), 'Mistakes box', '#/mistakes'); break;
      case 'tcards': startCards(allRefs(ti), TOPICS[ti].title, back); break;
      case 'seccards': startCards(sectionRefs(ti, sec), `${TOPICS[ti].title} · ${sec}`, back); break;
      case 'next': nextQ(); break;
      case 'retrywrong': startQuiz(Q.wrong.map((it) => [it.ti, it.qi]), `${Q.title} · retry`, Q.back); break;
      case 'donequiz': case 'quitquiz': { const b = Q ? Q.back : '#/home'; Q = null; go(b); break; }
      case 'flip': flipCard(); break;
      case 'knew': cardMark(true); break;
      case 'again': cardMark(false); break;
      case 'donecards': case 'quitcards': { const b = C ? C.back : '#/home'; C = null; go(b); break; }
      case 'dcheck': {
        const d = DIAGRAMS.find((x) => x.id === DG.id);
        DG.checked = true;
        const score = d.labels.filter((_, p) => isRight(d, p)).length;
        S.diag[d.id] = Math.max(S.diag[d.id] || 0, score);
        touchDay(); S.xp += score * 5; save();
        if (score === d.labels.length) setTimeout(confetti, 100);
        checkBadges(); render(); break;
      }
      case 'acquiz': startQuiz(acRefs(act.dataset.ac), `AC ${act.dataset.ac} practice`, '#/outcomes'); break;
      case 'mock': startQuiz(MOCK_REFS, 'Mock test · Part 1 MCQs', '#/exam', 0, true); Q.isMock = true; break;
      case 'toggle': { const k = act.dataset.key; if (opened.has(k)) opened.delete(k); else opened.add(k); render(); break; }
      case 'wmark': S.written[act.dataset.i] = Number(act.dataset.v); touchDay(); save(); opened.delete(`w${act.dataset.i}`); render(); break;
      case 'dclear': DG.placed = {}; DG.sel = null; DG.selPin = null; render(); break;
      case 'dreset': startDiagram(DG.id); render(); break;
      case 'dstudy': DG.study = true; DG.checked = false; render(); break;
      case 'resettopic': {
        const name = TOPICS[ti].title;
        if (!confirm(`Reset your progress for "${name}"?\n\nYour answers and mistakes for this topic will be cleared. XP, badges and other topics are kept.`)) break;
        TOPICS[ti].questions.forEach((_, qi) => { delete S.stats[qid(ti, qi)]; });
        S.mistakes = S.mistakes.filter((id) => Number(id.split('-')[0]) !== ti);
        save(); toast('🌱', `${name} reset — fresh start!`); render(); break;
      }
      case 'reset':
        if (confirm('Reset all progress, badges and mistakes? This cannot be undone.')) { const theme = S.theme; S = blank(); S.theme = theme; save(); toast('🌱', 'Fresh start!'); render(); }
        break;
      default: break;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const [view] = route();
    if (view === 'quiz' && Q && Q.i < Q.items.length) {
      const n = Number(e.key);
      if (Q.picked === null && n >= 1 && n <= Q.items[Q.i].order.length) answer(n - 1);
      else if (Q.picked !== null && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); nextQ(); }
    }
    if (view === 'cards' && C && C.i < C.items.length) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipCard(); }
      else if (C.flipped && e.key === 'ArrowRight') cardMark(true);
      else if (C.flipped && e.key === 'ArrowLeft') cardMark(false);
    }
  });

  render();
})();
