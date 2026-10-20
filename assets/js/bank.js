// 题库加载与规范化
const LETTERS = 'ABCDEFGHIJ';
const cache = new Map();
let indexCache = null;
let dbPromise = null;

// 题库与用户都存放在 SQLite 数据库 data/bank.db 中，用 sql.js（WebAssembly）在浏览器里读取
const SQLJS_BASE = 'assets/vendor/sqljs/';
const DB_URL = 'data/bank.db';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`无法加载 ${src}`));
    document.head.appendChild(s);
  });
}

export function openDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      if (!window.initSqlJs) await loadScript(`${SQLJS_BASE}sql-wasm.js`);
      const [SQL, buf] = await Promise.all([
        window.initSqlJs({ locateFile: (f) => SQLJS_BASE + f }),
        fetch(DB_URL, { cache: 'no-cache' }).then((r) => {
          if (!r.ok) throw new Error(`无法读取题库数据库 ${DB_URL}`);
          return r.arrayBuffer();
        }),
      ]);
      return new SQL.Database(new Uint8Array(buf));
    })().catch((e) => { dbPromise = null; throw e; });
  }
  return dbPromise;
}

export function query(db, sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

const parse = (s, d) => { if (s == null || s === '') return d; try { return JSON.parse(s); } catch { return d; } };

export async function listBanks() {
  if (indexCache) return indexCache;
  const db = await openDb();
  indexCache = query(db, 'SELECT * FROM banks ORDER BY sort, id').map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    icon: b.icon,
    color: b.color,
    imageBase: b.image_base,
    exam: parse(b.exam, {}),
    scores: parse(b.scores, {}),
    ...(b.exports ? { exports: parse(b.exports, null) } : {}),
  }));
  return indexCache;
}

export async function getBank(id) {
  if (cache.has(id)) return cache.get(id);
  const list = await listBanks();
  const meta = list.find((b) => b.id === id);
  if (!meta) throw new Error(`题库「${id}」不存在`);
  const db = await openDb();
  const questions = query(db, 'SELECT * FROM questions WHERE bank_id = ? ORDER BY seq', [id]).map((q) => ({
    id: q.qid,
    type: q.type,
    chapter: q.chapter,
    question: q.question,
    options: parse(q.options, []),
    answer: parse(q.answer, ''),
    analysis: q.analysis,
    images: parse(q.images, []),
  }));
  const bank = normalize({ ...meta, questions });
  cache.set(id, bank);
  return bank;
}

/** 将 JSON 中的题目规范为统一结构 */
function normalize(bank) {
  const questions = (bank.questions || []).map((q, i) => {
    const type = q.type || 'single';
    const id = String(q.id ?? i + 1);
    let options = q.options || [];
    let answer;
    if (type === 'fill') {
      options = [];
      answer = String(q.answer ?? '').trim();
    } else if (type === 'judge') {
      options = options.length === 2 ? options : ['正确', '错误'];
      const v = q.answer;
      const isTrue = v === true || v === 'true' || v === 'A' || v === '对' || v === '正确' || v === 1;
      answer = isTrue ? 'A' : 'B';
    } else if (Array.isArray(q.answer)) {
      answer = q.answer.map((x) => (typeof x === 'number' ? LETTERS[x] : String(x).toUpperCase())).sort().join('');
    } else {
      answer = String(q.answer || '').toUpperCase().replace(/[^A-J]/g, '').split('').sort().join('');
    }
    return {
      id,
      type,
      chapter: q.chapter || '',
      question: q.question || '',
      options,
      answer,
      analysis: q.analysis || q.explanation || '',
      // 图片路径相对于 data/banks/ + imageBase
      images: (q.images || []).map((p) => (/^(https?:)?\/\//.test(p) || p.startsWith('data/') ? p : `data/banks/${bank.imageBase || ''}${p}`)),
    };
  });
  const exam = { count: 20, duration: 30, passScore: 60, ...(bank.exam || {}) };
  const scores = { single: 1, multiple: 2, judge: 1, fill: 1, ...(bank.scores || bank.exam?.scores || {}) };
  return { ...bank, questions, exam, scores, qmap: new Map(questions.map((q) => [q.id, q])) };
}

export const letter = (i) => LETTERS[i];

/** 判断作答是否正确，choice 为字母串，如 "AC" */
const normFill = (s) => String(s).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

export function isCorrect(q, choice) {
  if (!choice) return false;
  if (q.type === 'fill') {
    // 允许用 | 分隔多个可接受答案
    return q.answer.split('|').some((a) => normFill(a) === normFill(choice));
  }
  return choice.split('').sort().join('') === q.answer;
}

export function typeCount(bank) {
  const c = { single: 0, multiple: 0, judge: 0, fill: 0 };
  bank.questions.forEach((q) => (c[q.type] = (c[q.type] || 0) + 1));
  return c;
}
