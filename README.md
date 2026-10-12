# 题库 · 前端简易题库系统

一个纯静态的在线刷题系统：**题库用 JSON 存储，用户账号存放在 `data/users.json`，密码经 PBKDF2-SHA256 加盐哈希**。无需后端、无需构建，可直接部署到 GitHub Pages。

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

由于浏览器的安全限制（`fetch` 读取 JSON、Web Crypto 加密校验），**不能直接双击打开 `index.html`**，需要通过 HTTP 访问：

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

## 📚 题库格式

1. 在 `data/banks/` 下新建 JSON 文件
2. 在 `data/banks/index.json` 中登记：

```json
{
  "banks": [
    { "id": "hcia-ai", "file": "hcia-ai.json", "title": "HCIA-AI 认证练习", "description": "…", "icon": "AI", "color": "#4f6bff" }
  ]
}
```

题库文件：

```json
{
  "title": "HCIA-AI 认证练习",
  "exam":   { "count": 20, "duration": 30, "passScore": 60 },
  "scores": { "single": 1, "multiple": 2, "judge": 1 },
  "questions": [
    { "id": 1, "type": "single",   "chapter": "机器学习", "question": "题干", "options": ["A 项", "B 项", "C 项", "D 项"], "answer": "B",   "analysis": "解析" },
    { "id": 2, "type": "multiple", "chapter": "深度学习", "question": "题干", "options": ["…", "…", "…", "…"],          "answer": "ABD", "analysis": "解析" },
    { "id": 3, "type": "judge",    "chapter": "华为生态", "question": "题干",                                          "answer": true,  "analysis": "解析" }
  ]
}
```

| 字段 | 说明 |
| --- | --- |
| `id` | 题目唯一编号（数字或字符串）。**发布后请勿改动**，练习记录、错题和收藏都依赖它 |
| `type` | `single` 单选 / `multiple` 多选 / `judge` 判断 |
| `options` | 选项数组（最多 10 个）；判断题可省略，默认「正确 / 错误」 |
| `answer` | 单选 `"B"`；多选 `"ABD"`；判断 `true` / `false`。也支持下标数组 `[0, 2]` |
| `analysis` | 解析，可选 |
| `chapter` | 章节，可选 |
| `exam` | 模拟考试默认题量、时长（分钟）、及格分 |
| `scores` | 各题型分值，按权重折算为百分制；多选题须全对才得分 |

题目较多时可拆成分卷：在题库文件中用 `"parts": ["hcia-ai/part1.json", "hcia-ai/part2.json"]` 代替 `questions`，每个分卷文件包含自己的 `questions` 数组。

题干、选项、解析中可用反引号书写 `行内代码`，`\n` 换行。

## 📁 目录结构

```
bank/
├── index.html
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── app.js      # 路由与页面
│       ├── auth.js     # 登录与 PBKDF2 校验
│       ├── bank.js     # 题库加载与规范化
│       ├── store.js    # 学习数据（localStorage）
│       └── utils.js
├── data/
│   ├── users.json      # 用户与密码哈希
│   └── banks/          # 题库 JSON
└── tools/adduser.js    # 用户管理脚本
```

## 🔒 安全说明

- 密码不以明文保存，使用 PBKDF2-SHA256 + 每用户随机盐 + 10 万次迭代，在浏览器中用 Web Crypto 校验。
- 这是**纯静态站点**：`users.json` 和题库文件可以被直接访问，登录只是访问门槛，不能替代服务端鉴权。请设置足够强的密码，不要放入敏感内容。
- 练习进度、错题、收藏和考试记录保存在当前浏览器的 `localStorage` 中，按用户区分；换设备或清除浏览器数据后不会保留。
