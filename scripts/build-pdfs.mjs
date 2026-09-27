// Builds the submission PDFs from the Markdown in docs/ and the repo root.
// Markdown becomes HTML with print styles, Mermaid blocks render in the page,
// and headless Chrome prints it. Usage: npm run pdf  (set CHROME_PATH off Windows)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Marked } from 'marked';

const root = process.cwd();
const out = path.join(root, 'docs', 'pdf');
const work = path.join(root, '.data', 'pdf-build');
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const mermaidScript = pathToFileURL(path.join(root, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js')).href;

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const marked = new Marked({
  renderer: {
    code({ text, lang }) {
      if (lang === 'mermaid') return `<pre class="mermaid">${escapeHtml(text)}</pre>`;
      return `<pre><code>${escapeHtml(text)}</code></pre>`;
    },
  },
});

const css = `
@page { size: A4; margin: 14mm 15mm; }
* { box-sizing: border-box; }
body { font-family: 'Atkinson Hyperlegible', 'Segoe UI', sans-serif; font-size: 9.6pt; line-height: 1.42; color: #1d2126; margin: 0; }
h1, h2, h3 { font-family: 'Fraunces', Georgia, serif; color: #1d2126; line-height: 1.2; break-after: avoid; }
h1 { font-size: 20pt; margin: 0 0 2pt; }
h2 { font-size: 12.5pt; margin: 12pt 0 4pt; padding-top: 4pt; border-top: 1px solid #ddd5c5; }
h3 { font-size: 10.5pt; margin: 9pt 0 3pt; }
p { margin: 0 0 5pt; }
h1 + p { color: #4a5058; margin-bottom: 8pt; }
ul, ol { margin: 0 0 5pt; padding-left: 16pt; }
li { margin-bottom: 2pt; }
table { width: 100%; border-collapse: collapse; margin: 4pt 0 7pt; font-size: 8.6pt; break-inside: avoid; }
th, td { border: 1px solid #ddd5c5; padding: 3pt 5pt; text-align: left; vertical-align: top; }
th { background: #f1ece1; font-weight: 700; }
code { font-family: 'JetBrains Mono', Consolas, monospace; font-size: 8.2pt; background: #f1ece1; padding: 0 2pt; border-radius: 2pt; }
pre { background: #f6f3ec; border: 1px solid #e6dfd1; border-radius: 4pt; padding: 6pt 8pt; overflow: hidden; white-space: pre-wrap; font-size: 7.6pt; line-height: 1.35; break-inside: avoid; }
pre code { background: none; padding: 0; font-size: inherit; }
pre.mermaid { background: none; border: none; text-align: center; padding: 0; margin: 4pt 0 8pt; }
pre.mermaid svg { max-width: 100%; max-height: 105mm; height: auto; }
strong { color: #111; }
a { color: #2b4c7e; text-decoration: none; }
.page-break { break-before: page; }
`;

function page(title, markdown) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Fraunces:opsz,wght@9..144,600;9..144,700&family=JetBrains+Mono:wght@400;600&display=swap">
<style>${css}</style></head><body>${marked.parse(markdown)}
<script src="${mermaidScript}"></script>
<script>mermaid.initialize({ startOnLoad: true, theme: 'neutral', securityLevel: 'strict', fontFamily: 'Atkinson Hyperlegible, sans-serif' });</script>
</body></html>`;
}

// Pass names to build only some PDFs: npm run pdf -- research-note
const only = process.argv.slice(2);

function print(name, title, load) {
  if (only.length > 0 && !only.includes(name)) return;
  const html = path.join(work, `${name}.html`);
  const pdf = path.join(out, `${name}.pdf`);
  writeFileSync(html, page(title, load()));
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=20000',
    `--print-to-pdf=${pdf}`,
    pathToFileURL(html).href,
  ], { stdio: 'ignore' });
  console.log(`wrote ${path.relative(root, pdf)}`);
}

rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
mkdirSync(out, { recursive: true });

const read = (file) => readFileSync(path.join(root, file), 'utf8');
print('research-note', 'Research note: DesignKata', () => read('docs/research-note.md'));
print('design-note', 'Design note: DesignKata', () => read('docs/design-note.md'));
print('readme-and-ai-usage', 'DesignKata: README and AI usage', () => `${read('README.md')}\n\n<div class="page-break"></div>\n\n${read('AI_USAGE.md')}`);
