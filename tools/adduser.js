#!/usr/bin/env node
/**
 * 用户管理脚本（无需安装依赖，Node.js 16+）
 *
 *   添加/更新用户:  node tools/adduser.js <用户名> <密码> [显示名称] [角色]
 *   删除用户:       node tools/adduser.js --remove <用户名>
 *   列出用户:       node tools/adduser.js --list
 *
 * 密码使用 PBKDF2-SHA256（随机 16 字节盐，100000 次迭代）哈希后写入 data/users.json，
 * 与前端 assets/js/auth.js 的校验算法一致。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'users.json');
const ITERATIONS = 100000;

function load() {
  if (!fs.existsSync(FILE)) return { algorithm: 'PBKDF2-SHA256', iterations: ITERATIONS, users: [] };
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}
function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const args = process.argv.slice(2);
const data = load();

if (args[0] === '--list') {
  console.table(data.users.map(({ username, name, role }) => ({ username, name, role })));
  process.exit(0);
}

if (args[0] === '--remove') {
  const name = args[1];
  const before = data.users.length;
  data.users = data.users.filter((u) => u.username !== name);
  if (data.users.length === before) {
    console.error(`未找到用户 ${name}`);
    process.exit(1);
  }
  save(data);
  console.log(`已删除用户 ${name}`);
  process.exit(0);
}

const [username, password, displayName, role = 'user'] = args;
if (!username || !password) {
  console.log('用法: node tools/adduser.js <用户名> <密码> [显示名称] [角色]');
  process.exit(1);
}
if (!/^[\w.-]{2,32}$/.test(username)) {
  console.error('用户名只能包含字母、数字、下划线、点和短横线，长度 2-32');
  process.exit(1);
}
if (password.length < 6) {
  console.error('密码长度至少 6 位');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), ITERATIONS, 32, 'sha256').toString('hex');
const user = { username, name: displayName || username, role, salt, hash, iterations: ITERATIONS };

const i = data.users.findIndex((u) => u.username === username);
if (i >= 0) data.users[i] = { ...data.users[i], ...user };
else data.users.push(user);
save(data);
console.log(`${i >= 0 ? '已更新' : '已添加'}用户 ${username}（${user.name}）`);
