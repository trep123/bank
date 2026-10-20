#!/usr/bin/env python3
"""
题库 SQLite 管理脚本（只用 Python 3 标准库，无需安装依赖）

题库统一存放在 data/bank.db（SQLite）。前端用 sql.js（WebAssembly）在浏览器里直接读取。

  查看题库:            python tools/bankdb.py list
  导出为 JSON 便于编辑:  python tools/bankdb.py export <题库id> [输出文件.json]
  导出全部:            python tools/bankdb.py export-all [目录]           (默认 data/json/)
  导入/覆盖一个题库:    python tools/bankdb.py import <文件.json>
  从 JSON 目录重建:     python tools/bankdb.py import-all [目录]           (默认 data/json/)
  删除题库:            python tools/bankdb.py remove <题库id>

导入用的 JSON 与导出格式相同（一个文件 = 一个题库）：
{
  "id": "hcia-ai", "title": "…", "description": "…", "icon": "AI", "color": "#4f6bff",
  "imageBase": "hcia-ai/img/",
  "exam":   {"count": 60, "duration": 90, "passScore": 60},
  "scores": {"single": 1, "multiple": 2, "judge": 1},
  "exports": {"docx": "data/exports/hcia-ai.docx", "pdf": "…", "docxSize": 0, "pdfSize": 0},
  "sort": 10,
  "questions": [ {"id": 1, "type": "single", "question": "…", "options": ["…"], "answer": "B", "analysis": "…"} ]
}
"""
import json
import os
import sqlite3
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DB = os.path.join(ROOT, 'data', 'bank.db')
JSON_DIR = os.path.join(ROOT, 'data', 'json')

SCHEMA = """
CREATE TABLE IF NOT EXISTS banks (
  id          TEXT PRIMARY KEY,          -- 题库 id，小写字母/数字/-
  sort        INTEGER NOT NULL DEFAULT 0, -- 首页排序（小的在前）
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '#4f6bff',
  image_base  TEXT NOT NULL DEFAULT '',   -- 配图目录，相对 data/banks/
  exam        TEXT NOT NULL DEFAULT '{}', -- JSON: {"count","duration","passScore"}
  scores      TEXT NOT NULL DEFAULT '{}', -- JSON: 各题型分值
  exports     TEXT                        -- JSON，可空：导出文件信息
);
CREATE TABLE IF NOT EXISTS questions (
  bank_id   TEXT NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  seq       INTEGER NOT NULL,             -- 题目顺序
  qid       TEXT NOT NULL,                -- 题目 id（发布后勿改）
  type      TEXT NOT NULL DEFAULT 'single', -- single / multiple / judge / fill
  chapter   TEXT NOT NULL DEFAULT '',
  question  TEXT NOT NULL,
  options   TEXT NOT NULL DEFAULT '[]',   -- JSON 数组
  answer    TEXT NOT NULL,                -- JSON 值："B" / "ABD" / true / "文本"
  analysis  TEXT NOT NULL DEFAULT '',
  images    TEXT NOT NULL DEFAULT '[]',   -- JSON 数组：配图文件名
  PRIMARY KEY (bank_id, qid)
);
CREATE INDEX IF NOT EXISTS idx_questions_seq ON questions(bank_id, seq);
"""


def connect():
    con = sqlite3.connect(DB)
    con.execute('PRAGMA foreign_keys = ON')
    con.executescript(SCHEMA)
    return con


def dumps(v):
    return json.dumps(v, ensure_ascii=False, separators=(',', ':'))


def import_bank(con, data):
    bid = data.get('id')
    if not bid:
        raise SystemExit('JSON 缺少 "id" 字段')
    qs = data.get('questions') or []
    ids = [str(q.get('id', i + 1)) for i, q in enumerate(qs)]
    dup = {x for x in ids if ids.count(x) > 1}
    if dup:
        raise SystemExit(f'题库 {bid} 有重复的题目 id：{sorted(dup)[:10]}')
    with con:
        con.execute('DELETE FROM questions WHERE bank_id=?', (bid,))
        con.execute('DELETE FROM banks WHERE id=?', (bid,))
        con.execute(
            'INSERT INTO banks(id,sort,title,description,icon,color,image_base,exam,scores,exports) VALUES (?,?,?,?,?,?,?,?,?,?)',
            (bid, int(data.get('sort', 0)), data.get('title', bid), data.get('description', ''),
             data.get('icon', ''), data.get('color', '#4f6bff'), data.get('imageBase', ''),
             dumps(data.get('exam') or {}), dumps(data.get('scores') or {}),
             dumps(data['exports']) if data.get('exports') else None))
        con.executemany(
            'INSERT INTO questions(bank_id,seq,qid,type,chapter,question,options,answer,analysis,images) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [(bid, i + 1, ids[i], q.get('type', 'single'), q.get('chapter', ''), q.get('question', ''),
              dumps(q.get('options') or []), dumps(q.get('answer', '')), q.get('analysis') or q.get('explanation') or '',
              dumps(q.get('images') or [])) for i, q in enumerate(qs)])
    print(f'已导入 {bid}：{len(qs)} 题')


def export_bank(con, bid):
    con.row_factory = sqlite3.Row
    b = con.execute('SELECT * FROM banks WHERE id=?', (bid,)).fetchone()
    if not b:
        raise SystemExit(f'题库 {bid} 不存在')
    out = {'id': b['id'], 'sort': b['sort'], 'title': b['title'], 'description': b['description'],
           'icon': b['icon'], 'color': b['color']}
    if b['image_base']:
        out['imageBase'] = b['image_base']
    out['exam'] = json.loads(b['exam'])
    out['scores'] = json.loads(b['scores'])
    if b['exports']:
        out['exports'] = json.loads(b['exports'])
    out['questions'] = []
    for q in con.execute('SELECT * FROM questions WHERE bank_id=? ORDER BY seq', (bid,)):
        item = {'id': int(q['qid']) if q['qid'].isdigit() else q['qid'], 'type': q['type']}
        if q['chapter']:
            item['chapter'] = q['chapter']
        item['question'] = q['question']
        opts = json.loads(q['options'])
        if opts:
            item['options'] = opts
        item['answer'] = json.loads(q['answer'])
        item['analysis'] = q['analysis']
        imgs = json.loads(q['images'])
        if imgs:
            item['images'] = imgs
        out['questions'].append(item)
    con.row_factory = None
    return out


def write_json(path, data):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'已导出 {data["id"]} -> {path}')


def main(argv):
    if not argv:
        print(__doc__)
        return
    cmd, args = argv[0], argv[1:]
    con = connect()
    if cmd == 'list':
        for bid, title, n in con.execute(
                'SELECT b.id, b.title, COUNT(q.qid) FROM banks b LEFT JOIN questions q ON q.bank_id=b.id GROUP BY b.id ORDER BY b.sort, b.id'):
            print(f'{bid:16} {n:5} 题  {title}')
    elif cmd == 'export':
        bid = args[0]
        write_json(args[1] if len(args) > 1 else os.path.join(JSON_DIR, f'{bid}.json'), export_bank(con, bid))
    elif cmd == 'export-all':
        d = args[0] if args else JSON_DIR
        for (bid,) in con.execute('SELECT id FROM banks ORDER BY sort, id').fetchall():
            write_json(os.path.join(d, f'{bid}.json'), export_bank(con, bid))
    elif cmd == 'import':
        for p in args:
            with open(p, encoding='utf-8') as f:
                import_bank(con, json.load(f))
    elif cmd == 'import-all':
        d = args[0] if args else JSON_DIR
        for name in sorted(os.listdir(d)):
            if name.endswith('.json'):
                with open(os.path.join(d, name), encoding='utf-8') as f:
                    import_bank(con, json.load(f))
    elif cmd == 'remove':
        with con:
            con.execute('DELETE FROM questions WHERE bank_id=?', (args[0],))
            n = con.execute('DELETE FROM banks WHERE id=?', (args[0],)).rowcount
        print('已删除' if n else '不存在', args[0])
    else:
        print(__doc__)
        return
    con.execute('VACUUM')
    con.close()


if __name__ == '__main__':
    main(sys.argv[1:])
