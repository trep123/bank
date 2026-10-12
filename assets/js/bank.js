// 题库加载与规范化
const LETTERS = 'ABCDEFGHIJ';
const cache = new Map();
let indexCache = null;

export async function listBanks() {
  if (indexCache) return indexCache;
  const res = await fetch('data/banks/index.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('无法读取题库目录 data/banks/index.json');
  const data = await res.json();
  indexCache = data.banks || [];
  return indexCache;
}

export async function getBank(id) {
  if (cache.has(id)) return cache.get(id);
  const list = await listBanks();
  const meta = list.find((b) => b.id === id);
  if (!meta) throw new Error(`题库「${id}」不存在`);
  const res = await fetch(`data/banks/${meta.file}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`无法读取题库文件 ${meta.file}`);
  const raw = await res.json();
  // 大题库可拆分为多个分卷文件：{ "parts": ["xxx/part1.json", ...] }，每个分卷含 questions 数组
  if (Array.isArray(raw.parts) && raw.parts.length) {
    const chunks = await Promise.all(raw.parts.map(async (p) => {
      const r = await fetch(`data/banks/${p}`, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`无法读取题库分卷 ${p}`);
      return (await r.json()).questions || [];
    }));
    raw.questions = [...(raw.questions || []), ...chunks.flat()];
  }
  const bank = normalize({ ...meta, ...raw, id: meta.id });
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
