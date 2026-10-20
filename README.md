# 题库 · 前端简易题库系统

一个纯静态的在线刷题系统：**题库用 SQLite 数据库（`data/bank.db`）存储，浏览器端通过 [sql.js](https://github.com/sql-js/sql.js)（WebAssembly）直接读取；用户账号存放在 `data/users.json`，密码经 PBKDF2-SHA256 加盐哈希**。无需后端、无需构建，可直接部署到 GitHub Pages。

## ✨ 功能

- **登录**：账号由管理员通过脚本分配，支持「7 天内自动登录」
- **顺序练习**：自动记住上次做到的位置，随时继续
- **随机练习**：打乱题目顺序
- **即时反馈**：作答后立即显示对错、正确答案与解析；单选/判断点选即提交，多选勾选后提交
- **模拟考试**：自定义题量、时长、及格分；倒计时（最后 5 分钟变色提醒），时间到自动交卷；可标记题目；刷新页面可续考
- **成绩分析**：分数环、题型正确率、答题回顾（全部 / 错题 / 未答 / 答对筛选）
- **错题本**：答错自动收录，在错题本中答对自动移出
- **收藏**：收藏重点题目单独练习
- **考试记录**：成绩走势图、平均分、通过率
- **体验**：亮色/暗色主题、手机适配（答题卡底部抽屉）、键盘快捷键

### 键盘快捷键

| 按键 | 作用 |
| --- | --- |
| `A`–`D` 或 `1`–`4` | 选择选项 |
| `Enter` | 提交答案 / 下一题（练习） |
| `←` `→` | 上一题 / 下一题 |
| `F` | 收藏（练习） |
| `M` | 标记（考试） |

## 🚀 运行

由于浏览器的安全限制（`fetch` 读取数据库与 WASM、Web Crypto 加密校验），**不能直接双击打开 `index.html`**，需要通过 HTTP 访问：

```bash
# 任选其一
python -m http.server 8080
npx serve .
```

然后打开 <http://localhost:8080>。

### 部署到 GitHub Pages

仓库 **Settings → Pages → Build and deployment**，Source 选 `Deploy from a branch`，分支选 `main`、目录选 `/ (root)`，保存后访问 `https://<用户名>.github.io/bank/`。

### 默认账号

管理员账号 `Admin`，密码请向管理员索取。可用下方脚本修改。

## 👤 用户管理

```bash
node tools/adduser.js zhangsan MyPass123 "张三"   # 添加或修改密码
node tools/adduser.js --remove zhangsan           # 删除用户
node tools/adduser.js --list                      # 查看用户
```

脚本会生成随机盐并计算哈希，写入 `data/users.json`，提交到仓库即可生效。

`data/users.json` 结构：

```json
{
  "algorithm": "PBKDF2-SHA256",
  "iterations": 100000,
  "users": [
    { "username": "admin", "name": "管理员", "role": "admin", "salt": "…", "hash": "…", "iterations": 100000 }
  ]
}
```

可为用户加上 `"disabled": true` 停用账号。

## 🗂️ 题库存储：SQLite

所有题库都在一个 SQLite 文件 **`data/bank.db`** 里，配图和导出文件仍是普通文件：

```
data/
├── bank.db                        ← 全部题库（banks 表 + questions 表）
├── banks/
│   └── <id>/img/p012_1.jpeg …     ← 各题库配图
├── exports/<id>.docx / <id>.pdf   ← 可选：导出下载用的 Word / PDF
└── users.json
```

### 表结构

**`banks`**（一行一个题库，首页按 `sort` 从小到大排列）

| 列 | 说明 |
| --- | --- |
| `id` | 题库 id，小写字母、数字和 `-`（如 `hcip-h12-222`），配图目录、导出文件同名 |
| `sort` | 排序号，现有题库为 10、20、30… |
| `title` / `description` | 标题、简介（简介里的题量需手动更新） |
| `icon` / `color` | 卡片短文字、主题色 |
| `image_base` | 配图目录，相对 `data/banks/`，如 `h3c-gb0-372/img/` |
| `exam` | JSON：`{"count":60,"duration":120,"passScore":80}` |
| `scores` | JSON：`{"single":1,"multiple":2,"judge":1,"fill":1}` |
| `exports` | JSON，可空：`{"docx":"data/exports/<id>.docx","pdf":"…","docxSize":95575,"pdfSize":553034}` |

**`questions`**（一行一道题，主键 `bank_id + qid`）

| 列 | 说明 |
| --- | --- |
| `bank_id` | 所属题库 id |
| `seq` | 顺序练习时的题目顺序 |
| `qid` | 题目 id，题库内唯一。**发布后请勿改动**，错题、收藏、进度都依赖它 |
| `type` | `single` 单选 / `multiple` 多选 / `judge` 判断 / `fill` 填空 |
| `chapter` | 章节，可空 |
| `question` | 题干，可用反引号写 `行内代码`，`\n` 换行 |
| `options` | JSON 数组，最多 10 项；判断题可为 `[]`（默认「正确 / 错误」） |
| `answer` | JSON 值：单选 `"B"`、多选 `"ABD"`、判断 `true`/`false`、填空 `"文本"`（不区分大小写，可用竖线分隔多个可接受答案）；也支持下标数组 `[0,2]` |
| `analysis` | 解析，可空 |
| `images` | JSON 数组，配图文件名，如 `["p012_1.jpeg"]` |

### 修改题库的两种方式

**方式一：图形界面直接改**——用 [DB Browser for SQLite](https://sqlitebrowser.org/) 打开 `data/bank.db`，在「浏览数据」里改题干、答案、解析，或新增行，然后「写入更改」。JSON 列（`options`、`answer`、`images` 等）要保持合法 JSON，例如字符串要带双引号：`"B"`。

**方式二：导出成 JSON 编辑后再导入**（适合批量修改、新增整个题库），只需 Python 3：

```bash
python tools/bankdb.py list                      # 查看题库与题量
python tools/bankdb.py export hcia-ai            # 导出到 data/json/hcia-ai.json
#   …用编辑器修改 data/json/hcia-ai.json …
python tools/bankdb.py import data/json/hcia-ai.json   # 覆盖写回数据库
python tools/bankdb.py export-all                # 全部导出到 data/json/
python tools/bankdb.py import-all                # 从 data/json/ 全部导回
python tools/bankdb.py remove <id>               # 删除题库
```

`data/json/` 只是临时编辑目录，已加入 `.gitignore`，不会提交。

### 新增一个题库

1. 照下面格式写一个 JSON 文件（一个文件 = 一个题库）：
   ```json
   {
     "id": "h3c-gb0-372", "sort": 60,
     "title": "H3CSE-RS GB0-372 高级路由交换技术1",
     "description": "共 405 题：单选 107 · 多选 289 · 填空 9，含拓扑配图",
     "icon": "372", "color": "#e11d48",
     "imageBase": "h3c-gb0-372/img/",
     "exam":   { "count": 60, "duration": 120, "passScore": 80 },
     "scores": { "single": 1, "multiple": 2, "fill": 1 },
     "exports": { "docx": "data/exports/h3c-gb0-372.docx", "pdf": "data/exports/h3c-gb0-372.pdf", "docxSize": 1345147, "pdfSize": 2010735 },
     "questions": [
       { "id": "1-1", "type": "single", "chapter": "STP", "question": "题干", "options": ["A 项", "B 项", "C 项", "D 项"], "answer": "B", "analysis": "解析", "images": ["p012_1.jpeg"] },
       { "id": "1-2", "type": "multiple", "question": "题干", "options": ["…", "…", "…", "…"], "answer": "ABD", "analysis": "解析" },
       { "id": "1-3", "type": "judge", "question": "题干", "answer": true, "analysis": "解析" }
     ]
   }
   ```
   `imageBase`、`exports`、`chapter`、`images`、`analysis` 都可省略。
2. `python tools/bankdb.py import 文件.json`
3. 有配图就放进 `data/banks/<id>/img/`；有 Word / PDF 就放进 `data/exports/`。
4. 提交 `data/bank.db`（和图片）并 push 到 `main`，Pages 部署 1–2 分钟后刷新即可。站点在 Cloudflare 后面，如长时间不更新，可在 Cloudflare 清除 `data/bank.db` 的缓存。

## 📁 目录结构

```
bank/
├── index.html
├── assets/
│   ├── css/style.css
│   ├── js/
│   │   ├── app.js      # 路由与页面
│   │   ├── auth.js     # 登录与 PBKDF2 校验
│   │   ├── bank.js     # 题库加载（sql.js 读取 SQLite）与规范化
│   │   ├── store.js    # 学习数据（localStorage）
│   │   └── utils.js
│   └── vendor/sqljs/   # sql.js 1.13.0（sql-wasm.js + sql-wasm.wasm，MIT）
├── data/
│   ├── bank.db         # 题库 SQLite 数据库
│   ├── users.json      # 用户与密码哈希
│   ├── banks/<id>/img/ # 题库配图
│   └── exports/        # 可选：题库导出的 docx / pdf
└── tools/
    ├── adduser.js      # 用户管理脚本
    └── bankdb.py       # 题库 SQLite 导入 / 导出脚本
```

## 🔒 安全说明

- 密码不以明文保存，使用 PBKDF2-SHA256 + 每用户随机盐 + 10 万次迭代，在浏览器中用 Web Crypto 校验。
- 这是**纯静态站点**：`users.json` 和 `bank.db` 可以被直接下载，登录只是访问门槛，不能替代服务端鉴权。请设置足够强的密码，不要放入敏感内容。
- 练习进度、错题、收藏和考试记录保存在当前浏览器的 `localStorage` 中，按用户区分；换设备或清除浏览器数据后不会保留。
