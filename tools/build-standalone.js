/* 把 index.html + style.css + 三个脚本打包成单个可离线的 HTML */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const html = read('index.html');
const css = read('style.css');
const js = ['data.js', 'core.js', 'app.js']
  .map((f) => '/* ==== ' + f + ' ==== */\n' + read(f))
  .join('\n\n')
  .replace(/<\/script/gi, '<\\/script');

let out = html
  .replace(/<link rel="stylesheet" href="style\.css">/, '<style>\n' + css + '\n</style>')
  .replace(
    /<script src="data\.js"><\/script>\s*<script src="core\.js"><\/script>\s*<script src="app\.js"><\/script>/,
    '<script>\n' + js + '\n</script>'
  );

if (out.indexOf('<style>') < 0 || out.indexOf('==== app.js') < 0) {
  throw new Error('内联失败：index.html 结构变了？');
}

const target = path.join(root, 'standalone.html');
fs.writeFileSync(target, out, 'utf8');
console.log('已生成 ' + target + '  (' + (Buffer.byteLength(out) / 1024).toFixed(1) + ' KB)');
