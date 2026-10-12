import * as auth from './auth.js?v=20261013c';
import * as store from './store.js?v=20261013c';
import { listBanks, getBank, isCorrect, typeCount, letter } from './bank.js?v=20261013c';
import {
  $, $$, esc, rich, shuffle, fmtTime, fmtDuration, fmtDate, uid, toast, confirmDialog, icon, TYPE_LABEL,
} from './utils.js?v=20261013c';

const app = $('#app');
let cleanup = null; // 当前视图的清理函数（计时器、键盘监听等）
const onCleanup = (fn) => {
  const prev = cleanup;
  cleanup = () => { prev && prev(); fn(); };
};

/* =========================================================
 * 路由
 * ======================================================= */
const routes = [
  [/^#\/login$/, viewLogin, { public: true }],
  [/^#\/?$/, viewHome],
  [/^#\/practice\/([\w-]+)\/(seq|random|wrong|fav)$/, viewPractice],
  [/^#\/exam\/([\w-]+)$/, viewExamSetup],
  [/^#\/exam\/([\w-]+)\/run$/, viewExamRun],
  [/^#\/result\/([\w-]+)$/, viewResult],
  [/^#\/history$/, viewHistory],
];

async function router() {
  if (cleanup) { cleanup(); cleanup = null; }
  const hash = location.hash || '#/';
  for (const [re, fn, opt] of routes) {
    const m = hash.match(re);
    if (!m) continue;
    const user = auth.current();
    if (!opt?.public && !user) return go('#/login');
    if (opt?.public && user) return go('#/');
    try {
      await fn(...m.slice(1).map(decodeURIComponent));
    } catch (e) {
      console.error(e);
      app.innerHTML = shell(`
        <div class="empty">
          <div class="empty-ico danger">${icon('alert')}</div>
          <h3>出错了</h3><p>${esc(e.message)}</p>
          <a class="btn btn-primary" href="#/">返回首页</a>
        </div>`);
      bindShell();
    }
    window.scrollTo(0, 0);
    return;
  }
  go('#/');
}
function go(hash) {
  if (location.hash === hash) router();
  else location.hash = hash;
}
window.addEventListener('hashchange', router);

/* =========================================================
 * 页面框架
 * ======================================================= */
function themeIcon() {
  return document.documentElement.dataset.theme === 'dark' ? icon('sun') : icon('moon');
}
function toggleTheme() {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  localStorage.setItem('qb:theme', t);
  $$('[data-theme-toggle]').forEach((b) => (b.innerHTML = themeIcon()));
}

function shell(content, { wide = false } = {}) {
  const u = auth.current();
  return `
  <header class="topbar">
    <div class="topbar-inner ${wide ? 'wide' : ''}">
      <a class="brand" href="#/">
        <span class="brand-logo">${icon('check')}</span><span class="brand-name">题库</span>
      </a>
      <nav class="topnav">
        <a href="#/" class="${location.hash === '#/' || !location.hash ? 'active' : ''}">${icon('book')}<span>题库</span></a>
        <a href="#/history" class="${location.hash === '#/history' ? 'active' : ''}">${icon('history')}<span>考试记录</span></a>
      </nav>
      <div class="topbar-actions">
        <button class="icon-btn" data-theme-toggle title="切换主题">${themeIcon()}</button>
        <div class="user-menu">
          <button class="avatar" data-user-toggle title="${esc(u.name)}">${esc(u.name.slice(0, 1).toUpperCase())}</button>
          <div class="dropdown" data-user-dropdown>
            <div class="dropdown-head"><strong>${esc(u.name)}</strong><span>@${esc(u.username)}</span></div>
            <button class="dropdown-item" data-logout>${icon('logout')} 退出登录</button>
          </div>
        </div>
      </div>
    </div>
  </header>
  <main class="container ${wide ? 'wide' : ''}">${content}</main>`;
}

function bindShell() {
  $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', toggleTheme));
  const tog = $('[data-user-toggle]');
  const dd = $('[data-user-dropdown]');
  if (tog && dd) {
    tog.addEventListener('click', (e) => { e.stopPropagation(); dd.classList.toggle('open'); });
    const close = () => dd.classList.remove('open');
    document.addEventListener('click', close);
    onCleanup(() => document.removeEventListener('click', close));
  }
  $('[data-logout]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: '退出登录', message: '确定要退出当前账号吗？学习记录会保留在本设备上。', okText: '退出' });
    if (ok) { auth.logout(); go('#/login'); }
  });
}

/* =========================================================
 * 登录
 * ======================================================= */
async function viewLogin() {
  app.innerHTML = `
  <div class="login-page">
    <button class="icon-btn login-theme" data-theme-toggle title="切换主题">${themeIcon()}</button>
    <section class="login-hero">
      <div class="login-hero-inner">
        <div class="brand brand-lg"><span class="brand-logo">${icon('check')}</span><span class="brand-name">题库</span></div>
        <h1>专注刷题，<br>稳步提分。</h1>
        <p class="lead">顺序练习、随机练习、模拟考试、错题本，一个页面搞定备考。</p>
        <ul class="feature-list">
          <li>${icon('bolt')}<div><strong>即时反馈</strong><span>作答后立即显示对错与解析</span></div></li>
          <li>${icon('clock')}<div><strong>模拟考试</strong><span>限时组卷，自动判分，可中断续考</span></div></li>
          <li>${icon('target')}<div><strong>错题本</strong><span>答错自动收录，答对自动移出</span></div></li>
        </ul>
      </div>
    </section>
    <section class="login-panel">
      <form class="login-card" novalidate>
        <h2>欢迎回来</h2>
        <p class="muted">请使用管理员分配的账号登录</p>
        <label class="field">
          <span class="field-label">用户名</span>
          <div class="input-wrap">${icon('user')}<input name="username" autocomplete="username" placeholder="请输入用户名" autofocus /></div>
        </label>
        <label class="field">
          <span class="field-label">密码</span>
          <div class="input-wrap">${icon('lock')}<input name="password" type="password" autocomplete="current-password" placeholder="请输入密码" />
            <button type="button" class="pw-toggle" title="显示密码">${icon('eye')}</button></div>
        </label>
        <div class="login-row">
          <label class="check"><input type="checkbox" name="remember" /><span>7 天内自动登录</span></label>
        </div>
        <div class="form-error" role="alert"></div>
        <button class="btn btn-primary btn-block btn-lg" type="submit"><span class="btn-text">登 录</span></button>
        <p class="login-tip">${icon('lock')} 密码经 PBKDF2-SHA256 加盐哈希校验，不以明文保存</p>
      </form>
    </section>
  </div>`;
  $('[data-theme-toggle]').addEventListener('click', toggleTheme);
  const form = $('.login-card');
  const pw = form.elements.password;
  $('.pw-toggle').addEventListener('click', (e) => {
    const show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    e.currentTarget.innerHTML = show ? icon('eyeOff') : icon('eye');
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', form);
    const err = $('.form-error', form);
    err.textContent = '';
    btn.disabled = true;
    btn.classList.add('loading');
    try {
      const s = await auth.login(form.elements.username.value, pw.value, form.elements.remember.checked);
      toast(`欢迎，${s.name}`, 'success');
      go('#/');
    } catch (ex) {
      err.textContent = ex.message;
      form.classList.remove('shake');
      void form.offsetWidth;
      form.classList.add('shake');
      pw.select();
    } finally {
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  });
}

/* =========================================================
 * 首页：统计 + 题库列表
 * ======================================================= */
async function viewHome() {
  app.innerHTML = shell(`<div class="boot"><div class="spinner"></div></div>`);
  bindShell();
  const metas = await listBanks();
  const banks = await Promise.all(metas.map((m) => getBank(m.id).catch(() => null)));
  const d = store.load();
  const u = auth.current();
  const draft = store.loadDraft();

  let totalDone = 0, totalRight = 0, totalWrong = 0;
  banks.filter(Boolean).forEach((b) => {
    const st = store.bankState(d, b.id);
    const ans = Object.entries(st.answered).filter(([qid]) => b.qmap.has(qid));
    totalDone += ans.length;
    totalRight += ans.filter(([, a]) => a.correct).length;
    totalWrong += st.wrong.filter((q) => b.qmap.has(q)).length;
  });
  const acc = totalDone ? Math.round((totalRight / totalDone) * 100) : 0;
  const best = d.exams.length ? Math.max(...d.exams.map((e) => e.score)) : null;

  const hour = new Date().getHours();
  const greet = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

  const cards = banks.map((b, i) => {
    if (!b) return `<div class="bank-card"><p class="muted">题库「${esc(metas[i].title || metas[i].id)}」加载失败</p></div>`;
    const st = store.bankState(d, b.id);
    const total = b.questions.length;
    const done = Object.keys(st.answered).filter((q) => b.qmap.has(q)).length;
    const right = Object.entries(st.answered).filter(([q, a]) => b.qmap.has(q) && a.correct).length;
    const wrong = st.wrong.filter((q) => b.qmap.has(q)).length;
    const fav = st.fav.filter((q) => b.qmap.has(q)).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const tc = typeCount(b);
    const color = b.color || '#4f6bff';
    return `
    <article class="bank-card" style="--accent:${esc(color)}">
      <div class="bank-head">
        <div class="bank-icon ${(b.icon || '').length > 2 ? 'sm' : ''}">${esc(b.icon || b.title.slice(0, 1))}</div>
        <div class="bank-title">
          <h3>${esc(b.title)}</h3>
          <p>${esc(b.description || '')}</p>
        </div>
        <button class="icon-btn sm" data-reset="${esc(b.id)}" title="重置该题库的练习记录">${icon('refresh')}</button>
      </div>
      <div class="bank-tags">
        <span class="tag">共 ${total} 题</span>
        ${tc.single ? `<span class="tag">单选 ${tc.single}</span>` : ''}
        ${tc.multiple ? `<span class="tag">多选 ${tc.multiple}</span>` : ''}
        ${tc.judge ? `<span class="tag">判断 ${tc.judge}</span>` : ''}
        ${tc.fill ? `<span class="tag">填空 ${tc.fill}</span>` : ''}
      </div>
      <div class="progress-block">
        <div class="progress-meta"><span>已练习 <b>${done}</b> / ${total}</span><span>正确率 <b>${done ? Math.round((right / done) * 100) : 0}%</b></span></div>
        <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
      </div>
      ${draft && draft.bankId === b.id ? `<a class="resume-banner" href="#/exam/${esc(b.id)}/run">${icon('clock')} 有一场未完成的模拟考试，点击继续</a>` : ''}
      <div class="bank-actions">
        <a class="btn btn-primary" href="#/practice/${esc(b.id)}/seq">${icon('play')} ${st.pos > 0 ? '继续练习' : '顺序练习'}</a>
        <a class="btn btn-soft" href="#/practice/${esc(b.id)}/random">${icon('shuffle')} 随机</a>
        <a class="btn btn-soft" href="#/exam/${esc(b.id)}">${icon('clock')} 模拟考试</a>
      </div>
      <div class="bank-links">
        <a href="#/practice/${esc(b.id)}/wrong" class="${wrong ? '' : 'disabled'}">${icon('target')} 错题本 <b>${wrong}</b></a>
        <a href="#/practice/${esc(b.id)}/fav" class="${fav ? '' : 'disabled'}">${icon('star')} 收藏 <b>${fav}</b></a>
        ${b.exports ? `<a href="javascript:;" data-export="${esc(b.id)}">${icon('download')} 导出</a>` : ''}
      </div>
    </article>`;
  }).join('');

  $('main').innerHTML = `
    <section class="hello">
      <div>
        <h1>${greet}，${esc(u.name)}</h1>
        <p class="muted">${totalDone ? '保持节奏，每天进步一点点。' : '从一个题库开始你的第一次练习吧。'}</p>
      </div>
    </section>
    <section class="stats">
      <div class="stat"><div class="stat-ico c1">${icon('edit')}</div><div><span>累计练习</span><b>${totalDone}</b></div></div>
      <div class="stat"><div class="stat-ico c2">${icon('target')}</div><div><span>正确率</span><b>${acc}<small>%</small></b></div></div>
      <div class="stat"><div class="stat-ico c3">${icon('alert')}</div><div><span>待攻克错题</span><b>${totalWrong}</b></div></div>
      <div class="stat"><div class="stat-ico c4">${icon('trophy')}</div><div><span>考试最高分</span><b>${best ?? '—'}</b></div></div>
    </section>
    <div class="section-head"><h2>我的题库</h2><span class="muted">${banks.filter(Boolean).length} 个题库</span></div>
    <section class="bank-grid">${cards || '<p class="muted">暂无题库，请在 data/banks/index.json 中添加。</p>'}</section>`;

  $$('[data-export]').forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    const b = banks.find((x) => x && x.id === el.dataset.export);
    if (b) exportDialog(b);
  }));
  $$('.bank-links a.disabled').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); toast('这里还是空的', 'info'); }));
  $$('[data-reset]').forEach((btn) => btn.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '重置练习记录',
      message: '将清空该题库的练习进度、错题本和收藏（考试记录保留）。此操作不可撤销。',
      okText: '重置', danger: true,
    });
    if (!ok) return;
    const dd = store.load();
    store.resetBank(dd, btn.dataset.reset);
    store.save(dd);
    toast('已重置', 'success');
    router();
  }));
}

/* =========================================================
 * 题目渲染（练习 / 考试 / 回顾共用）
 * ======================================================= */
function renderQuestion(q, { index, total, sel = '', revealed = false, fav = false, flagged = false, showFlag = false, showFav = true }) {
  const multi = q.type === 'multiple';
  const fill = q.type === 'fill';
  const opts = fill ? `
      <div class="fill-wrap ${revealed ? (isCorrect(q, sel) ? 'correct' : 'wrong') : ''}">
        <input class="fill-input" data-fill type="text" autocomplete="off" spellcheck="false" placeholder="在此输入答案，按 Enter 确认" value="${esc(sel)}" ${revealed ? 'disabled' : ''} />
      </div>` : q.options.map((text, i) => {
    const k = letter(i);
    const chosen = sel.includes(k);
    const isAns = q.answer.includes(k);
    let cls = chosen ? 'selected' : '';
    let mark = '';
    if (revealed) {
      if (isAns && chosen) { cls = 'correct'; mark = icon('check'); }
      else if (isAns) { cls = 'missed'; mark = icon('check'); }
      else if (chosen) { cls = 'wrong'; mark = icon('x'); }
      else cls = 'dim';
    }
    return `
      <button class="opt ${cls} ${multi ? 'multi' : ''}" data-key="${k}" ${revealed ? 'disabled' : ''}>
        <span class="opt-key">${k}</span>
        <span class="opt-text">${rich(text)}</span>
        <span class="opt-mark">${mark}</span>
      </button>`;
  }).join('');
  const imgs = q.images?.length ? `<div class="q-images">${q.images.map((src) => `
      <button class="q-img" data-zoom="${esc(src)}" title="点击放大"><img src="${esc(src)}" alt="题目配图" loading="lazy" /></button>`).join('')}</div>` : '';
  const showAns = (v) => (q.type === 'judge' ? esc(q.options[v === 'A' ? 0 : 1]) : fill ? esc(v) : v);

  let feedback = '';
  if (revealed) {
    const ok = isCorrect(q, sel);
    const unanswered = !sel;
    feedback = `
      <div class="feedback ${ok ? 'ok' : 'bad'}">
        <div class="feedback-head">
          <span class="feedback-ico">${ok ? icon('check') : icon('x')}</span>
          <strong>${ok ? '回答正确' : unanswered ? '未作答' : '回答错误'}</strong>
          <span class="feedback-ans">正确答案 <b>${showAns(fill ? q.answer.split('|').join(' 或 ') : q.answer)}</b>${sel && !ok ? `，你的答案 <b>${showAns(sel)}</b>` : ''}</span>
        </div>
        ${q.analysis ? `<div class="analysis"><div class="analysis-title">解析</div><div>${rich(q.analysis)}</div></div>` : ''}
      </div>`;
  }

  return `
    <article class="q-card" data-qid="${esc(q.id)}">
      <div class="q-meta">
        <span class="badge badge-${q.type}">${TYPE_LABEL[q.type] || '题目'}</span>
        ${q.chapter ? `<span class="q-chapter">${esc(q.chapter)}</span>` : ''}
        <span class="q-spacer"></span>
        ${showFlag ? `<button class="chip-btn ${flagged ? 'on flag' : ''}" data-flag title="标记，稍后检查 (M)">${icon('flag')}<span>${flagged ? '已标记' : '标记'}</span></button>` : ''}
        ${showFav ? `<button class="chip-btn ${fav ? 'on fav' : ''}" data-fav title="收藏 (F)">${icon('star')}<span>${fav ? '已收藏' : '收藏'}</span></button>` : ''}
      </div>
      <div class="q-no">第 <b>${index + 1}</b> 题 <span>/ 共 ${total} 题</span></div>
      <div class="q-text">${rich(q.question)}</div>
      ${imgs}
      ${multi && !revealed ? '<div class="q-hint">多选题：选择所有正确选项后点击「提交答案」</div>' : ''}
      ${fill && !revealed ? '<div class="q-hint">填空题：不区分大小写，多余空格会被忽略</div>' : ''}
      <div class="options">${opts}</div>
      ${feedback}
    </article>`;
}

function sheetHTML(items, currentIdx) {
  // items: [{state:'correct'|'wrong'|'answered'|'', flagged}]
  return items.map((it, i) => `
    <button class="sheet-cell ${it.state} ${i === currentIdx ? 'current' : ''} ${it.flagged ? 'flagged' : ''}" data-goto="${i}">${i + 1}</button>`).join('');
}

/** 统一的键盘快捷键绑定 */
function bindKeys(handler) {
  const fn = (e) => {
    if (e.target.closest?.('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector('.modal-mask')) return;
    handler(e);
  };
  document.addEventListener('keydown', fn);
  onCleanup(() => document.removeEventListener('keydown', fn));
}

function keyToOption(e, q) {
  const k = e.key.toUpperCase();
  if (/^[1-9]$/.test(k)) {
    const i = Number(k) - 1;
    return i < q.options.length ? letter(i) : null;
  }
  if (/^[A-J]$/.test(k)) {
    const i = k.charCodeAt(0) - 65;
    return i < q.options.length ? k : null;
  }
  return null;
}

/* 导出题库（docx / pdf，含答案与解析） */
function exportDialog(b) {
  const ex = b.exports;
  const size = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  const file = (ext) => `${b.title.replace(/[\\/:*?"<>|\s]+/g, '_')}.${ext}`;
  const wrap = document.createElement('div');
  wrap.className = 'modal-mask';
  wrap.innerHTML = `
    <div class="modal export-modal" role="dialog" aria-modal="true">
      <h3 class="modal-title">导出题库</h3>
      <p class="muted export-sub">${esc(b.title)} · ${b.questions.length} 题，含答案与解析${b.questions.some((q) => q.images.length) ? '及配图' : ''}</p>
      <div class="export-opts">
        <a class="export-opt" href="${esc(ex.docx)}" download="${esc(file('docx'))}">
          <span class="export-ico doc">W</span>
          <span><b>Word 文档</b><small>.docx · ${size(ex.docxSize || 0)} · 可编辑</small></span>
          ${icon('download')}
        </a>
        <a class="export-opt" href="${esc(ex.pdf)}" download="${esc(file('pdf'))}">
          <span class="export-ico pdf">PDF</span>
          <span><b>PDF 文档</b><small>.pdf · ${size(ex.pdfSize || 0)} · 适合打印</small></span>
          ${icon('download')}
        </a>
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" data-act="close">关闭</button></div>
    </div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  const close = () => { wrap.classList.remove('show'); document.removeEventListener('keydown', onKey, true); setTimeout(() => wrap.remove(), 200); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-act="close"]')) close();
    else if (e.target.closest('.export-opt')) { toast('开始下载…', 'success'); setTimeout(close, 300); }
  });
}

/* 禁止双指缩放 / 双击缩放（iOS Safari 会忽略 user-scalable=no） */
['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

/* 图片放大查看 */
function openLightbox(src) {
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.innerHTML = `<img src="${esc(src)}" alt="" /><button class="icon-btn lightbox-close" title="关闭">${icon('x')}</button>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const close = () => { el.classList.remove('show'); document.removeEventListener('keydown', onKey, true); setTimeout(() => el.remove(), 200); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  el.addEventListener('click', close);
}
document.addEventListener('click', (e) => {
  const z = e.target.closest?.('[data-zoom]');
  if (z) openLightbox(z.dataset.zoom);
});

/* =========================================================
 * 练习模式
 * ======================================================= */
const MODE_NAME = { seq: '顺序练习', random: '随机练习', wrong: '错题本', fav: '我的收藏' };

async function viewPractice(bankId, mode) {
  const bank = await getBank(bankId);
  let d = store.load();
  let st = store.bankState(d, bankId);

  let list;
  if (mode === 'seq') list = bank.questions;
  else if (mode === 'random') list = shuffle(bank.questions);
  else if (mode === 'wrong') list = st.wrong.map((id) => bank.qmap.get(id)).filter(Boolean);
  else list = st.fav.map((id) => bank.qmap.get(id)).filter(Boolean);

  if (!list.length) {
    app.innerHTML = shell(`
      <div class="empty">
        <div class="empty-ico">${mode === 'wrong' ? icon('trophy') : icon('star')}</div>
        <h3>${mode === 'wrong' ? '错题本是空的' : '还没有收藏题目'}</h3>
        <p>${mode === 'wrong' ? '太棒了！目前没有待攻克的错题。' : '练习时点击题目右上角的「收藏」即可加入这里。'}</p>
        <a class="btn btn-primary" href="#/practice/${esc(bankId)}/seq">去练习</a>
      </div>`);
    bindShell();
    return;
  }

  const session = list.map(() => ({ sel: '', revealed: false }));
  let idx = mode === 'seq' ? Math.min(st.pos, list.length - 1) : 0;
  let sessionRight = 0, sessionDone = 0;

  app.innerHTML = shell(`
    <div class="quiz-top">
      <a class="icon-btn" href="#/" title="返回">${icon('back')}</a>
      <div class="quiz-title"><h2>${esc(bank.title)}</h2><span class="pill">${MODE_NAME[mode]}</span></div>
      <div class="quiz-top-right">
        <label class="switch" title="答对后自动跳到下一题"><input type="checkbox" data-autonext ${d.settings.autoNext ? 'checked' : ''}/><span class="switch-track"></span><span class="switch-label">答对自动下一题</span></label>
      </div>
    </div>
    <div class="quiz-progress"><div class="progress thin"><div class="progress-bar" data-pbar></div></div><span data-ptext></span></div>
    <div class="quiz-layout">
      <section class="quiz-main">
        <div data-qwrap></div>
        <div class="quiz-nav">
          <button class="btn btn-ghost" data-prev>${icon('left')} 上一题</button>
          <button class="btn btn-primary btn-wide" data-primary></button>
          <button class="btn btn-ghost" data-next>下一题 ${icon('right')}</button>
        </div>
        <p class="kbd-tip">${icon('keyboard')} 快捷键：<kbd>A</kbd>–<kbd>D</kbd> 或 <kbd>1</kbd>–<kbd>4</kbd> 选择，<kbd>Enter</kbd> 提交 / 下一题，<kbd>←</kbd> <kbd>→</kbd> 切换，<kbd>F</kbd> 收藏</p>
      </section>
      <aside class="sheet" data-sheet>
        <div class="sheet-head"><h4>答题卡</h4><button class="icon-btn sm sheet-close" data-sheet-close>${icon('x')}</button></div>
        <div class="sheet-stats" data-sstats></div>
        <div class="sheet-grid" data-sgrid></div>
        <div class="sheet-legend">
          <span><i class="lg correct"></i>正确</span><span><i class="lg wrong"></i>错误</span><span><i class="lg"></i>未答</span>
        </div>
      </aside>
    </div>
    <button class="fab" data-sheet-open>${icon('grid')}<span>答题卡</span></button>
    <div class="sheet-mask" data-sheet-close></div>
  `, { wide: true });
  bindShell();

  const autoNextBox = $('[data-autonext]');
  autoNextBox.addEventListener('change', () => {
    d = store.load();
    d.settings.autoNext = autoNextBox.checked;
    store.save(d);
  });

  let autoTimer = null;
  onCleanup(() => clearTimeout(autoTimer));

  function render() {
    const q = list[idx];
    const s = session[idx];
    d = store.load();
    st = store.bankState(d, bankId);
    $('[data-qwrap]').innerHTML = renderQuestion(q, {
      index: idx, total: list.length, sel: s.sel, revealed: s.revealed, fav: st.fav.includes(q.id),
    });
    const primary = $('[data-primary]');
    if (s.revealed) {
      primary.innerHTML = idx < list.length - 1 ? `下一题 ${icon('right')}` : '完成练习';
      primary.disabled = false;
    } else {
      primary.innerHTML = '提交答案';
      primary.disabled = !s.sel;
    }
    $('[data-prev]').disabled = idx === 0;
    $('[data-next]').disabled = idx === list.length - 1;

    const doneCount = session.filter((x) => x.revealed).length;
    $('[data-pbar]').style.width = `${((idx + 1) / list.length) * 100}%`;
    $('[data-ptext]').textContent = `${idx + 1} / ${list.length}`;
    $('[data-sgrid]').innerHTML = sheetHTML(
      session.map((x, i) => ({ state: x.revealed ? (isCorrect(list[i], x.sel) ? 'correct' : 'wrong') : '' })), idx
    );
    $('[data-sstats]').innerHTML = `
      <div><b>${doneCount}</b><span>本次已答</span></div>
      <div><b class="ok">${sessionRight}</b><span>答对</span></div>
      <div><b class="bad">${sessionDone - sessionRight}</b><span>答错</span></div>`;
    $('.sheet-cell.current')?.scrollIntoView({ block: 'nearest' });

    if (mode === 'seq') {
      st.pos = idx;
      store.save(d);
    }
    focusFill();
  }

  function focusFill() {
    const inp = $('[data-fill]');
    if (inp && !inp.disabled && window.matchMedia('(pointer: fine)').matches) inp.focus();
  }
  app.addEventListener('input', onInput);
  onCleanup(() => app.removeEventListener('input', onInput));
  function onInput(e) {
    if (!e.target.matches('[data-fill]')) return;
    session[idx].sel = e.target.value.trim();
    $('[data-primary]').disabled = !session[idx].sel;
  }
  app.addEventListener('keydown', onFillKey);
  onCleanup(() => app.removeEventListener('keydown', onFillKey));
  function onFillKey(e) {
    if (!e.target.matches('[data-fill]') || e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    submit();
  }

  function choose(k) {
    const q = list[idx];
    const s = session[idx];
    if (s.revealed) return;
    if (q.type === 'multiple') {
      s.sel = s.sel.includes(k) ? s.sel.replace(k, '') : (s.sel + k).split('').sort().join('');
      render();
    } else {
      s.sel = k;
      submit();
    }
  }

  function submit() {
    const q = list[idx];
    const s = session[idx];
    if (s.revealed || !s.sel) return;
    s.revealed = true;
    const ok = isCorrect(q, s.sel);
    sessionDone++;
    if (ok) sessionRight++;
    d = store.load();
    store.recordAnswer(d, bankId, q.id, s.sel, ok, { fromWrongBook: mode === 'wrong' });
    store.save(d);
    render();
    if (!ok) $('.feedback')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (ok && autoNextBox.checked && idx < list.length - 1) {
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => { if (session[idx] === s) move(1); }, 750);
    }
  }

  function move(delta) {
    const n = idx + delta;
    if (n < 0 || n >= list.length) return;
    clearTimeout(autoTimer);
    idx = n;
    render();
    closeSheet();
  }

  async function finish() {
    const msg = `本次共作答 <b>${sessionDone}</b> 题，答对 <b>${sessionRight}</b> 题${sessionDone ? `，正确率 <b>${Math.round((sessionRight / sessionDone) * 100)}%</b>` : ''}。`;
    if (mode === 'seq') { d = store.load(); store.bankState(d, bankId).pos = 0; store.save(d); }
    await confirmDialog({ title: '练习完成 🎉', message: msg, okText: '返回首页', cancelText: '' });
    go('#/');
  }

  const openSheet = () => document.body.classList.add('sheet-open');
  const closeSheet = () => document.body.classList.remove('sheet-open');

  app.addEventListener('click', onClick);
  onCleanup(() => { app.removeEventListener('click', onClick); closeSheet(); });
  function onClick(e) {
    const t = e.target;
    const opt = t.closest('.opt');
    if (opt && !opt.disabled) return choose(opt.dataset.key);
    if (t.closest('[data-primary]')) {
      if (session[idx].revealed) return idx < list.length - 1 ? move(1) : finish();
      return submit();
    }
    if (t.closest('[data-prev]')) return move(-1);
    if (t.closest('[data-next]')) return move(1);
    const g = t.closest('[data-goto]');
    if (g) { idx = Number(g.dataset.goto); clearTimeout(autoTimer); render(); closeSheet(); return; }
    if (t.closest('[data-fav]')) return fav();
    if (t.closest('[data-sheet-open]')) return openSheet();
    if (t.closest('[data-sheet-close]')) return closeSheet();
  }

  function fav() {
    d = store.load();
    const on = store.toggleFav(d, bankId, list[idx].id);
    store.save(d);
    toast(on ? '已加入收藏' : '已取消收藏', on ? 'success' : 'info', 1200);
    render();
  }

  bindKeys((e) => {
    const q = list[idx];
    if (e.key === 'ArrowLeft') return move(-1);
    if (e.key === 'ArrowRight') return move(1);
    if (e.key === 'Enter') {
      e.preventDefault();
      if (session[idx].revealed) return idx < list.length - 1 ? move(1) : finish();
      return submit();
    }
    if (e.key.toLowerCase() === 'f') return fav();
    const k = keyToOption(e, q);
    if (k) choose(k);
  });

  render();
}

/* =========================================================
 * 模拟考试：设置页
 * ======================================================= */
async function viewExamSetup(bankId) {
  const bank = await getBank(bankId);
  const draft = store.loadDraft();
  const total = bank.questions.length;
  const defCount = Math.min(bank.exam.count, total);
  const counts = [...new Set([10, 20, 30, 50, 100].filter((n) => n < total).concat([defCount, total]))].sort((a, b) => a - b);
  const tc = typeCount(bank);

  app.innerHTML = shell(`
    <div class="quiz-top">
      <a class="icon-btn" href="#/" title="返回">${icon('back')}</a>
      <div class="quiz-title"><h2>模拟考试</h2><span class="pill">${esc(bank.title)}</span></div>
    </div>
    <div class="exam-setup">
      ${draft ? `
      <div class="resume-card">
        <div>${icon('clock')}</div>
        <div><strong>你有一场未完成的考试</strong><span>${esc(draft.bankTitle)} · 剩余 ${fmtTime(Math.max(0, draft.endAt - Date.now()) / 1000)}</span></div>
        <a class="btn btn-primary" href="#/exam/${esc(draft.bankId)}/run">继续考试</a>
      </div>` : ''}
      <form class="setup-card">
        <h3>考试设置</h3>
        <div class="setup-grid">
          <label class="field"><span class="field-label">题目数量</span>
            <select name="count">${counts.map((n) => `<option value="${n}" ${n === defCount ? 'selected' : ''}>${n === total ? `全部 ${n} 题` : `${n} 题`}</option>`).join('')}</select></label>
          <label class="field"><span class="field-label">考试时长</span>
            <select name="duration">${[10, 15, 20, 30, 45, 60, 90, 120].concat(bank.exam.duration).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)
              .map((m) => `<option value="${m}" ${m === bank.exam.duration ? 'selected' : ''}>${m} 分钟</option>`).join('')}</select></label>
          <label class="field"><span class="field-label">及格分数</span>
            <select name="pass">${[60, 70, 80, 90].concat(bank.exam.passScore).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)
              .map((s) => `<option value="${s}" ${s === bank.exam.passScore ? 'selected' : ''}>${s} 分</option>`).join('')}</select></label>
        </div>
        <ul class="rules">
          <li>${icon('shuffle')} 从题库 ${total} 题中随机抽题（${['single', 'multiple', 'judge', 'fill'].filter((t) => tc[t]).map((t) => `${TYPE_LABEL[t].slice(0, 2)} ${tc[t]}`).join(' · ')}）</li>
          <li>${icon('target')} 计分权重：${['single', 'multiple', 'judge', 'fill'].filter((t) => tc[t]).map((t) => `${TYPE_LABEL[t].slice(0, 2)} ${bank.scores[t]} 分`).join('、')}，折算为百分制；多选题须全部选对才得分</li>
          <li>${icon('clock')} 时间到自动交卷；中途刷新或关闭页面可继续作答</li>
          <li>${icon('flag')} 可标记不确定的题目，交卷前在答题卡中快速定位</li>
        </ul>
        <button class="btn btn-primary btn-lg btn-block" type="submit">${icon('play')} 开始考试</button>
      </form>
    </div>`);
  bindShell();

  $('.setup-card').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (draft) {
      const ok = await confirmDialog({ title: '开始新考试', message: '开始新考试将放弃当前未完成的考试，确定继续吗？', okText: '开始新考试', danger: true });
      if (!ok) return;
    }
    const f = e.currentTarget.elements;
    const count = Number(f.count.value);
    const minutes = Number(f.duration.value);
    // 按题型排序：单选 → 多选 → 判断，题型内随机
    const order = { single: 0, multiple: 1, judge: 2, fill: 3 };
    const picked = shuffle(bank.questions).slice(0, count).sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));
    store.saveDraft({
      id: uid(),
      bankId,
      bankTitle: bank.title,
      qids: picked.map((q) => q.id),
      answers: {},
      flags: [],
      idx: 0,
      startAt: Date.now(),
      endAt: Date.now() + minutes * 60000,
      durationMin: minutes,
      passScore: Number(f.pass.value),
    });
    go(`#/exam/${bankId}/run`);
  });
}

/* =========================================================
 * 模拟考试：答题
 * ======================================================= */
async function viewExamRun(bankId) {
  const draft = store.loadDraft();
  if (!draft || draft.bankId !== bankId) return go(`#/exam/${bankId}`);
  const bank = await getBank(bankId);
  const list = draft.qids.map((id) => bank.qmap.get(id)).filter(Boolean);
  if (!list.length) { store.clearDraft(); return go(`#/exam/${bankId}`); }
  let idx = Math.min(draft.idx || 0, list.length - 1);
  let submitted = false;

  app.innerHTML = `
  <header class="exam-bar">
    <div class="exam-bar-inner">
      <button class="icon-btn" data-exit title="退出（进度会保留）">${icon('back')}</button>
      <div class="exam-bar-title"><strong>${esc(bank.title)}</strong><span>模拟考试 · ${list.length} 题</span></div>
      <div class="timer" data-timer>${icon('clock')}<span></span></div>
      <button class="btn btn-primary" data-submit>交卷</button>
    </div>
    <div class="progress thin flat"><div class="progress-bar" data-pbar></div></div>
  </header>
  <main class="container wide">
    <div class="quiz-layout exam">
      <section class="quiz-main">
        <div data-qwrap></div>
        <div class="quiz-nav">
          <button class="btn btn-ghost" data-prev>${icon('left')} 上一题</button>
          <button class="btn btn-primary btn-wide" data-next-main>下一题 ${icon('right')}</button>
          <button class="btn btn-ghost" data-next>下一题 ${icon('right')}</button>
        </div>
        <p class="kbd-tip">${icon('keyboard')} 快捷键：<kbd>A</kbd>–<kbd>D</kbd> 选择，<kbd>←</kbd> <kbd>→</kbd> 切换，<kbd>M</kbd> 标记</p>
      </section>
      <aside class="sheet" data-sheet>
        <div class="sheet-head"><h4>答题卡</h4><button class="icon-btn sm sheet-close" data-sheet-close>${icon('x')}</button></div>
        <div class="sheet-stats" data-sstats></div>
        <div class="sheet-grid" data-sgrid></div>
        <div class="sheet-legend">
          <span><i class="lg answered"></i>已答</span><span><i class="lg"></i>未答</span><span><i class="lg flagged"></i>标记</span>
        </div>
        <button class="btn btn-primary btn-block" data-submit>交卷</button>
      </aside>
    </div>
    <button class="fab" data-sheet-open>${icon('grid')}<span>答题卡</span></button>
    <div class="sheet-mask" data-sheet-close></div>
  </main>`;

  const persist = () => { draft.idx = idx; store.saveDraft(draft); };

  function render() {
    const q = list[idx];
    $('[data-qwrap]').innerHTML = renderQuestion(q, {
      index: idx, total: list.length, sel: draft.answers[q.id] || '',
      showFlag: true, flagged: draft.flags.includes(q.id), showFav: false,
    });
    $('[data-prev]').disabled = idx === 0;
    $('[data-next]').disabled = idx === list.length - 1;
    const nm = $('[data-next-main]');
    nm.innerHTML = idx === list.length - 1 ? '检查并交卷' : `下一题 ${icon('right')}`;
    renderSide();
    const inp = $('[data-fill]');
    if (inp && window.matchMedia('(pointer: fine)').matches) inp.focus();
  }

  function renderSide() {
    const answered = list.filter((x) => draft.answers[x.id]).length;
    $('[data-pbar]').style.width = `${(answered / list.length) * 100}%`;
    $('[data-sgrid]').innerHTML = sheetHTML(
      list.map((x) => ({ state: draft.answers[x.id] ? 'answered' : '', flagged: draft.flags.includes(x.id) })), idx
    );
    $('[data-sstats]').innerHTML = `
      <div><b>${answered}</b><span>已答</span></div>
      <div><b>${list.length - answered}</b><span>未答</span></div>
      <div><b class="warn">${draft.flags.length}</b><span>标记</span></div>`;
    $('.sheet-cell.current')?.scrollIntoView({ block: 'nearest' });
    persist();
  }

  app.addEventListener('input', onInput);
  onCleanup(() => app.removeEventListener('input', onInput));
  function onInput(e) {
    if (!e.target.matches('[data-fill]')) return;
    const v = e.target.value.trim();
    if (v) draft.answers[list[idx].id] = v; else delete draft.answers[list[idx].id];
    renderSide();
  }
  app.addEventListener('keydown', onFillKey);
  onCleanup(() => app.removeEventListener('keydown', onFillKey));
  function onFillKey(e) {
    if (!e.target.matches('[data-fill]') || e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    if (idx < list.length - 1) move(1);
  }

  function choose(k) {
    const q = list[idx];
    const cur = draft.answers[q.id] || '';
    if (q.type === 'multiple') {
      const n = cur.includes(k) ? cur.replace(k, '') : (cur + k).split('').sort().join('');
      if (n) draft.answers[q.id] = n; else delete draft.answers[q.id];
    } else {
      draft.answers[q.id] = k;
    }
    render();
  }

  function move(delta) {
    const n = idx + delta;
    if (n < 0 || n >= list.length) return;
    idx = n;
    render();
    document.body.classList.remove('sheet-open');
  }

  function toggleFlag() {
    const id = list[idx].id;
    draft.flags = draft.flags.includes(id) ? draft.flags.filter((x) => x !== id) : [...draft.flags, id];
    render();
  }

  // 计时
  const timerEl = $('[data-timer]');
  function tick() {
    const left = (draft.endAt - Date.now()) / 1000;
    $('span', timerEl).textContent = fmtTime(left);
    timerEl.classList.toggle('warn', left <= 300);
    timerEl.classList.toggle('danger', left <= 60);
    if (left <= 0 && !submitted) {
      toast('考试时间到，已自动交卷', 'warning', 3000);
      grade();
    }
  }
  const timer = setInterval(tick, 1000);
  onCleanup(() => clearInterval(timer));
  tick();

  async function trySubmit() {
    const un = list.filter((x) => !draft.answers[x.id]).length;
    const fl = draft.flags.length;
    let msg = '交卷后将无法修改答案。';
    if (un) msg = `还有 <b class="bad">${un}</b> 题未作答，${msg}`;
    if (fl) msg += `<br>你标记了 <b>${fl}</b> 道题待检查。`;
    const ok = await confirmDialog({ title: '确认交卷', message: msg, okText: '确认交卷', cancelText: '继续答题' });
    if (ok) grade();
  }

  function grade() {
    if (submitted) return;
    submitted = true;
    clearInterval(timer);
    const d = store.load();
    let earned = 0, full = 0, correct = 0;
    const byType = {};
    const items = list.map((q) => {
      const sel = draft.answers[q.id] || '';
      const ok = isCorrect(q, sel);
      const w = bank.scores[q.type] ?? 1;
      full += w;
      if (ok) { earned += w; correct++; }
      byType[q.type] ||= { total: 0, correct: 0 };
      byType[q.type].total++;
      if (ok) byType[q.type].correct++;
      if (sel) store.recordAnswer(d, bankId, q.id, sel, ok);
      else {
        const st = store.bankState(d, bankId);
        if (!st.wrong.includes(q.id)) st.wrong.push(q.id);
      }
      return { qid: q.id, sel, ok };
    });
    const score = full ? Math.round((earned / full) * 100) : 0;
    const record = {
      id: draft.id,
      bankId,
      bankTitle: bank.title,
      at: Date.now(),
      used: Math.min(Date.now(), draft.endAt) - draft.startAt,
      durationMin: draft.durationMin,
      total: list.length,
      correct,
      answered: items.filter((x) => x.sel).length,
      score,
      passScore: draft.passScore,
      pass: score >= draft.passScore,
      byType,
      items,
    };
    store.addExam(d, record);
    store.save(d);
    store.clearDraft();
    go(`#/result/${record.id}`);
  }

  async function exit() {
    const ok = await confirmDialog({
      title: '暂时离开', message: '答题进度会自动保存，<b>但计时不会暂停</b>。确定离开吗？', okText: '离开', cancelText: '继续答题',
    });
    if (ok) go('#/');
  }

  app.addEventListener('click', onClick);
  onCleanup(() => { app.removeEventListener('click', onClick); document.body.classList.remove('sheet-open'); });
  function onClick(e) {
    const t = e.target;
    const opt = t.closest('.opt');
    if (opt) return choose(opt.dataset.key);
    if (t.closest('[data-prev]')) return move(-1);
    if (t.closest('[data-next]')) return move(1);
    if (t.closest('[data-next-main]')) return idx === list.length - 1 ? trySubmit() : move(1);
    const g = t.closest('[data-goto]');
    if (g) { idx = Number(g.dataset.goto); render(); document.body.classList.remove('sheet-open'); return; }
    if (t.closest('[data-flag]')) return toggleFlag();
    if (t.closest('[data-submit]')) return trySubmit();
    if (t.closest('[data-exit]')) return exit();
    if (t.closest('[data-sheet-open]')) return document.body.classList.add('sheet-open');
    if (t.closest('[data-sheet-close]')) return document.body.classList.remove('sheet-open');
  }

  bindKeys((e) => {
    if (e.key === 'ArrowLeft') return move(-1);
    if (e.key === 'ArrowRight') return move(1);
    if (e.key.toLowerCase() === 'm') return toggleFlag();
    const k = keyToOption(e, list[idx]);
    if (k) choose(k);
  });

  render();
}

/* =========================================================
 * 考试结果 / 回顾
 * ======================================================= */
async function viewResult(recordId) {
  const d = store.load();
  const r = d.exams.find((x) => x.id === recordId);
  if (!r) throw new Error('找不到该考试记录');
  const bank = await getBank(r.bankId);
  const R = 54, C = 2 * Math.PI * R;
  const color = r.pass ? 'var(--success)' : 'var(--danger)';
  const wrongCount = r.items.filter((x) => x.sel && !x.ok).length;
  const unCount = r.items.filter((x) => !x.sel).length;

  const typeRows = Object.entries(r.byType).map(([t, v]) => {
    const p = v.total ? Math.round((v.correct / v.total) * 100) : 0;
    return `<div class="type-row"><span>${TYPE_LABEL[t] || t}</span>
      <div class="progress"><div class="progress-bar" style="width:${p}%"></div></div>
      <b>${v.correct}/${v.total}</b></div>`;
  }).join('');

  app.innerHTML = shell(`
    <div class="quiz-top">
      <a class="icon-btn" href="#/history" title="返回">${icon('back')}</a>
      <div class="quiz-title"><h2>考试结果</h2><span class="pill">${esc(r.bankTitle)}</span></div>
    </div>
    <section class="result-hero ${r.pass ? 'pass' : 'fail'}">
      <div class="score-ring">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="${R}" class="ring-bg"/>
          <circle cx="60" cy="60" r="${R}" class="ring-fg" style="stroke:${color};stroke-dasharray:${C};stroke-dashoffset:${C}" data-ring="${C * (1 - r.score / 100)}"/>
        </svg>
        <div class="score-text"><b>${r.score}</b><span>分</span></div>
      </div>
      <div class="result-info">
        <span class="result-badge">${r.pass ? `${icon('trophy')} 通过考试` : `${icon('alert')} 未通过`}</span>
        <h3>${r.pass ? '表现很棒，继续保持！' : `距离及格（${r.passScore} 分）还差 ${r.passScore - r.score} 分`}</h3>
        <div class="result-stats">
          <div><b class="ok">${r.correct}</b><span>答对</span></div>
          <div><b class="bad">${wrongCount}</b><span>答错</span></div>
          <div><b>${unCount}</b><span>未答</span></div>
          <div><b>${fmtDuration(r.used / 1000)}</b><span>用时</span></div>
        </div>
        <div class="type-rows">${typeRows}</div>
        <div class="result-actions">
          <a class="btn btn-primary" href="#/exam/${esc(r.bankId)}">${icon('refresh')} 再考一次</a>
          <a class="btn btn-soft" href="#/practice/${esc(r.bankId)}/wrong">${icon('target')} 练习错题</a>
          <a class="btn btn-ghost" href="#/">返回首页</a>
        </div>
      </div>
    </section>
    <div class="section-head">
      <h2>答题回顾</h2>
      <div class="tabs" data-tabs>
        <button class="tab active" data-filter="all">全部 ${r.items.length}</button>
        <button class="tab" data-filter="wrong">错题 ${wrongCount}</button>
        <button class="tab" data-filter="un">未答 ${unCount}</button>
        <button class="tab" data-filter="ok">答对 ${r.correct}</button>
      </div>
    </div>
    <section class="review-list" data-review></section>`);
  bindShell();

  requestAnimationFrame(() => setTimeout(() => {
    const ring = $('[data-ring]');
    if (ring) ring.style.strokeDashoffset = ring.dataset.ring;
  }, 60));

  function renderList(filter) {
    const st = store.bankState(store.load(), r.bankId);
    const html = r.items.map((it, i) => ({ it, i })).filter(({ it }) =>
      filter === 'all' || (filter === 'wrong' && it.sel && !it.ok) || (filter === 'un' && !it.sel) || (filter === 'ok' && it.ok)
    ).map(({ it, i }) => {
      const q = bank.qmap.get(it.qid);
      if (!q) return '';
      return renderQuestion(q, { index: i, total: r.items.length, sel: it.sel, revealed: true, fav: st.fav.includes(q.id) });
    }).join('');
    $('[data-review]').innerHTML = html || '<div class="empty small"><p>这里没有题目</p></div>';
  }
  renderList('all');

  $('[data-tabs]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    $$('.tab', e.currentTarget).forEach((x) => x.classList.toggle('active', x === b));
    renderList(b.dataset.filter);
  });
  $('[data-review]').addEventListener('click', (e) => {
    const f = e.target.closest('[data-fav]');
    if (!f) return;
    const qid = f.closest('.q-card').dataset.qid;
    const dd = store.load();
    const on = store.toggleFav(dd, r.bankId, qid);
    store.save(dd);
    f.classList.toggle('on', on);
    f.classList.toggle('fav', on);
    $('span', f).textContent = on ? '已收藏' : '收藏';
    toast(on ? '已加入收藏' : '已取消收藏', on ? 'success' : 'info', 1200);
  });
}

/* =========================================================
 * 考试记录
 * ======================================================= */
async function viewHistory() {
  const d = store.load();
  const ex = d.exams;
  const avg = ex.length ? Math.round(ex.reduce((s, e) => s + e.score, 0) / ex.length) : 0;
  const passRate = ex.length ? Math.round((ex.filter((e) => e.pass).length / ex.length) * 100) : 0;
  const recent = ex.slice(0, 12).reverse();

  const chart = recent.length > 1 ? (() => {
    const W = 600, H = 160, P = 24;
    const step = (W - P * 2) / (recent.length - 1);
    const pts = recent.map((e, i) => [P + i * step, H - P - (e.score / 100) * (H - P * 2)]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1][0]},${H - P} L${pts[0][0]},${H - P} Z`;
    const passY = H - P - (60 / 100) * (H - P * 2);
    return `
      <div class="chart-card">
        <div class="chart-head"><h4>最近成绩走势</h4><span class="muted">最近 ${recent.length} 次</span></div>
        <svg viewBox="0 0 ${W} ${H}" class="chart" preserveAspectRatio="none">
          <defs><linearGradient id="g1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--primary)" stop-opacity=".25"/><stop offset="1" stop-color="var(--primary)" stop-opacity="0"/></linearGradient></defs>
          <line x1="${P}" x2="${W - P}" y1="${passY}" y2="${passY}" class="chart-pass"/>
          <path d="${area}" fill="url(#g1)"/>
          <path d="${line}" class="chart-line"/>
          ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" class="chart-dot ${recent[i].pass ? '' : 'fail'}"><title>${recent[i].score} 分</title></circle>`).join('')}
        </svg>
      </div>`;
  })() : '';

  app.innerHTML = shell(`
    <section class="hello"><div><h1>考试记录</h1><p class="muted">回顾每一次模拟考试的表现</p></div></section>
    <section class="stats">
      <div class="stat"><div class="stat-ico c1">${icon('edit')}</div><div><span>考试次数</span><b>${ex.length}</b></div></div>
      <div class="stat"><div class="stat-ico c2">${icon('target')}</div><div><span>平均分</span><b>${ex.length ? avg : '—'}</b></div></div>
      <div class="stat"><div class="stat-ico c4">${icon('trophy')}</div><div><span>最高分</span><b>${ex.length ? Math.max(...ex.map((e) => e.score)) : '—'}</b></div></div>
      <div class="stat"><div class="stat-ico c3">${icon('check')}</div><div><span>通过率</span><b>${ex.length ? passRate : '—'}<small>${ex.length ? '%' : ''}</small></b></div></div>
    </section>
    ${chart}
    ${ex.length ? `
    <div class="history-list">
      ${ex.map((e) => `
        <a class="history-item" href="#/result/${esc(e.id)}">
          <div class="h-score ${e.pass ? 'pass' : 'fail'}">${e.score}</div>
          <div class="h-main"><strong>${esc(e.bankTitle)}</strong><span>${fmtDate(e.at)} · ${e.total} 题 · 用时 ${fmtDuration(e.used / 1000)}</span></div>
          <span class="h-tag ${e.pass ? 'pass' : 'fail'}">${e.pass ? '通过' : '未通过'}</span>
          ${icon('right', 'h-arrow')}
        </a>`).join('')}
    </div>` : `
    <div class="empty">
      <div class="empty-ico">${icon('clock')}</div>
      <h3>还没有考试记录</h3><p>完成一次模拟考试后，成绩会出现在这里。</p>
      <a class="btn btn-primary" href="#/">去选择题库</a>
    </div>`}`);
  bindShell();
}

router();
