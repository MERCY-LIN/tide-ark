/* 检查 app.js 里引用的元素 id 是否都有定义（index.html 或运行时生成的 modal HTML） */
const fs = require('fs');
const path = require('path');
const base = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(base, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');

const refs = new Set();
for (const m of app.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)) refs.add(m[1]);

const defined = new Set();
for (const m of html.matchAll(/id="([A-Za-z0-9_-]+)"/g)) defined.add(m[1]);
for (const m of app.matchAll(/id="([A-Za-z0-9_-]+)"/g)) defined.add(m[1]);

const missing = [...refs].filter((r) => !defined.has(r));
console.log('引用 id:', refs.size, ' 定义 id:', defined.size);
console.log('缺失:', missing.length ? missing.join(', ') : '无');

/* 检查每个 openModal 之后绑定的 id 是否出现在同一段 HTML 里 */
const blocks = app.split('function ').filter((b) => b.includes('openModal('));
let issues = 0;
for (const b of blocks) {
  const name = b.slice(0, b.indexOf('('));
  const ids = [...b.matchAll(/\$\('([A-Za-z0-9_-]+)'\)\.addEventListener/g)].map((m) => m[1]);
  for (const id of ids) {
    if (!b.includes('id="' + id + '"')) {
      console.log('  ⚠', name, '绑定了 id=' + id + ' 但这段 HTML 里没有');
      issues++;
    }
  }
}
console.log(issues ? '存在 ' + issues + ' 处绑定风险' : '绑定检查通过');
