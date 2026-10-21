// 学习数据：按用户保存在浏览器 localStorage（练习进度、错题本、收藏、考试记录）
import { current } from './auth.js?v=20261021a';

const key = () => `qb:data:${current()?.username || 'guest'}`;
const draftKey = () => `qb:exam-draft:${current()?.username || 'guest'}`;
const MAX_EXAMS = 100;

const empty = () => ({ banks: {}, exams: [], settings: { autoNext: true, reciteHide: false } });

export function load() {
  try {
    const d = JSON.parse(localStorage.getItem(key()));
    if (!d) return empty();
    d.banks ||= {};
    d.exams ||= [];
    d.settings = { autoNext: true, reciteHide: false, ...(d.settings || {}) };
    return d;
  } catch {
    return empty();
  }
}

export function save(d) {
  try {
    localStorage.setItem(key(), JSON.stringify(d));
  } catch (e) {
    console.warn('保存失败', e);
  }
}

/** 取得（并初始化）某题库的学习状态 */
export function bankState(d, bankId) {
  d.banks[bankId] ||= { answered: {}, wrong: [], fav: [], pos: 0, mastered: [], recitePos: {} };
  const b = d.banks[bankId];
  b.answered ||= {};
  b.wrong ||= [];
  b.fav ||= [];
  b.pos ||= 0;
  b.mastered ||= [];
  b.recitePos ||= {};
  return b;
}

/** 记录一次作答结果（练习与考试共用） */
export function recordAnswer(d, bankId, qid, choice, correct, { fromWrongBook = false } = {}) {
  const b = bankState(d, bankId);
  const prev = b.answered[qid] || { times: 0, right: 0 };
  b.answered[qid] = { choice, correct, times: prev.times + 1, right: prev.right + (correct ? 1 : 0), at: Date.now() };
  if (!correct && !b.wrong.includes(qid)) b.wrong.push(qid);
  // 在错题本中答对则移出错题本
  if (correct && fromWrongBook) b.wrong = b.wrong.filter((x) => x !== qid);
}

export function toggleFav(d, bankId, qid) {
  const b = bankState(d, bankId);
  const i = b.fav.indexOf(qid);
  if (i >= 0) b.fav.splice(i, 1);
  else b.fav.push(qid);
  return i < 0;
}

export function addExam(d, record) {
  d.exams.unshift(record);
  if (d.exams.length > MAX_EXAMS) d.exams.length = MAX_EXAMS;
}

export function resetBank(d, bankId) {
  delete d.banks[bankId];
}

/* ---------- 进行中的考试（刷新/误关闭可继续） ---------- */
export function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(draftKey()));
  } catch {
    return null;
  }
}
export function saveDraft(draft) {
  localStorage.setItem(draftKey(), JSON.stringify(draft));
}
export function clearDraft() {
  localStorage.removeItem(draftKey());
}
