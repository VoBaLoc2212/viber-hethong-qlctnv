import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve('.');
const mdPath = resolve(projectRoot, 'docs/HUONG_DAN_SU_DUNG_WEBSITE.md');
const pdfPath = resolve(projectRoot, 'docs/HUONG_DAN_SU_DUNG_WEBSITE.pdf');

const markdown = readFileSync(mdPath, 'utf8');

function escapeHtml(input) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseMarkdownToHtml(md) {
  const lines = md.split(/\r?\n/);
  const html = [];
  let inList = false;
  let inCode = false;
  let codeLang = '';

  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  const closeCode = () => {
    if (inCode) {
      html.push('</code></pre>');
      inCode = false;
      codeLang = '';
    }
  };

  for (const raw of lines) {
    const line = raw ?? '';

    if (line.startsWith('```')) {
      closeList();
      if (!inCode) {
        codeLang = line.slice(3).trim();
        html.push(`<pre><code class="language-${escapeHtml(codeLang)}">`);
        inCode = true;
      } else {
        closeCode();
      }
      continue;
    }

    if (inCode) {
      html.push(`${escapeHtml(line)}\n`);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const htmlText = renderInline(text);
      const id = slugify(stripMarkdownLinks(text));
      html.push(`<h${level} id="${id}">${htmlText}</h${level}>`);
      continue;
    }

    if (line.match(/^\s*[-*]\s+/)) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      const item = line.replace(/^\s*[-*]\s+/, '').trim();
      html.push(`<li>${renderInline(item)}</li>`);
      continue;
    }

    if (!line.trim()) {
      closeList();
      html.push('');
      continue;
    }

    closeList();

    if (/^---+$/.test(line.trim())) {
      html.push('<hr />');
      continue;
    }

    if (line.trim().startsWith('>')) {
      const quote = line.trim().replace(/^>\s?/, '');
      html.push(`<blockquote>${renderInline(quote)}</blockquote>`);
      continue;
    }

    html.push(`<p>${renderInline(line.trim())}</p>`);
  }

  closeList();
  closeCode();

  return html.join('\n');
}

function stripMarkdownLinks(text) {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
}

function slugify(value) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return normalized || 'section';
}

function renderInline(text) {
  let result = escapeHtml(text);

  result = result.replace(/\[([^\]]+)\]\((#[^)]+)\)/g, (_m, label, href) => {
    const target = href.slice(1).trim();
    const normalizedHref = `#${slugify(target)}`;
    return `<a href="${escapeHtml(normalizedHref)}">${escapeHtml(label)}</a>`;
  });

  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

  return result;
}

const bodyHtml = parseMarkdownToHtml(markdown);

const fullHtml = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hướng dẫn sử dụng website</title>
  <style>
    @page { size: A4; margin: 18mm 14mm 18mm 14mm; }
    html, body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
    body { font-size: 12px; line-height: 1.55; }
    h1 { font-size: 24px; margin: 0 0 14px; page-break-after: avoid; }
    h2 { font-size: 18px; margin: 24px 0 10px; page-break-after: avoid; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
    h3 { font-size: 15px; margin: 16px 0 8px; page-break-after: avoid; }
    p { margin: 8px 0; }
    ul { margin: 8px 0 8px 18px; }
    li { margin: 3px 0; }
    hr { border: 0; border-top: 1px solid #e5e7eb; margin: 14px 0; }
    blockquote {
      margin: 8px 0;
      padding: 8px 12px;
      border-left: 3px solid #9ca3af;
      background: #f9fafb;
      color: #374151;
    }
    code {
      font-family: Consolas, 'Courier New', monospace;
      font-size: 11px;
      background: #f3f4f6;
      border-radius: 4px;
      padding: 1px 4px;
    }
    pre {
      overflow: auto;
      background: #f3f4f6;
      border-radius: 6px;
      padding: 10px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    a { color: #1d4ed8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .cover {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 18px;
      background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%);
    }
    .cover h1 { margin-bottom: 6px; }
    .muted { color: #6b7280; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <section class="cover">
    <h1>HƯỚNG DẪN SỬ DỤNG WEBSITE</h1>
    <p><strong>Hệ thống quản lý ngân sách & thu/chi</strong></p>
    <p class="muted">Tài liệu được xuất tự động từ file markdown nội bộ.</p>
  </section>
  ${bodyHtml}
</body>
</html>`;

const tempHtmlPath = resolve(projectRoot, 'docs/.tmp-user-guide.html');
writeFileSync(tempHtmlPath, fullHtml, 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${tempHtmlPath}`);
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `<div style="width:100%;font-size:9px;padding:0 10mm;color:#6b7280;display:flex;justify-content:space-between;"><span>BudgetFlow - Hướng dẫn sử dụng</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`,
  margin: { top: '20mm', right: '14mm', bottom: '18mm', left: '14mm' },
});
await browser.close();

console.log(`Generated PDF: ${pdfPath}`);
