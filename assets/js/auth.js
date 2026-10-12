// 登录认证：用户信息存放在 data/users.json，密码以 PBKDF2-SHA256 + 随机盐 哈希保存
// 浏览器端通过 Web Crypto API 计算哈希并比对，明文密码不会存储或传输。

const SESSION_KEY = 'qb:session';
const REMEMBER_DAYS = 7;
const enc = new TextEncoder();

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/.{2}/g).map((x) => parseInt(x, 16)));

/** PBKDF2-SHA256，输出 32 字节十六进制字符串（与 tools/adduser.js 一致） */
export async function pbkdf2(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations },
    key,
    256
  );
  return toHex(bits);
}

/** 恒定时间比较，避免按字符提前返回 */
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

let usersCache = null;
async function loadUsers() {
  if (usersCache) return usersCache;
  const res = await fetch('data/users.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('无法读取用户文件 data/users.json');
  usersCache = await res.json();
  return usersCache;
}

export async function login(username, password, remember = false) {
  if (!window.crypto?.subtle) {
    throw new Error('当前环境不支持加密校验，请通过 https 或 http://localhost 访问');
  }
  username = username.trim();
  if (!username || !password) throw new Error('请输入用户名和密码');

  const data = await loadUsers();
  const user = (data.users || []).find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (user && user.disabled) throw new Error('该账号已被停用');

  // 用户不存在时也计算一次哈希，使响应时间一致
  const salt = user?.salt || '00'.repeat(16);
  const iterations = user?.iterations || data.iterations || 100000;
  const hash = await pbkdf2(password, salt, iterations);
  if (!user || !safeEqual(hash, user.hash)) throw new Error('用户名或密码错误');

  const session = {
    username: user.username,
    name: user.name || user.username,
    role: user.role || 'user',
    loginAt: Date.now(),
    expires: remember ? Date.now() + REMEMBER_DAYS * 864e5 : null,
  };
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function current() {
  const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (s.expires && Date.now() > s.expires) {
      logout();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}
