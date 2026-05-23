import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, writeFile } from "@tauri-apps/plugin-fs";
import { marked, type Token, type Tokens } from "marked";
import DOMPurify from "dompurify";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

type PdfMakeModule = {
  createPdf: (def: TDocumentDefinitions) => { getBlob: () => Promise<Blob> };
  addVirtualFileSystem: (vfs: unknown) => void;
};

let pdfMakePromise: Promise<PdfMakeModule> | null = null;

// pdfmake + its Roboto VFS adds ~1 MB to the bundle; lazy-load on first export
// so initial app start stays light.
function loadPdfMake(): Promise<PdfMakeModule> {
  if (!pdfMakePromise) {
    pdfMakePromise = Promise.all([
      import("pdfmake/build/pdfmake"),
      import("pdfmake/build/vfs_fonts"),
    ]).then(([pdfMakeMod, vfsMod]) => {
      const pdfMake = (pdfMakeMod.default ?? pdfMakeMod) as PdfMakeModule;
      const vfs = (vfsMod as { default?: unknown }).default ?? vfsMod;
      pdfMake.addVirtualFileSystem(vfs);
      return pdfMake;
    });
  }
  return pdfMakePromise;
}

/**
 * Renders the current markdown content to a full, self-contained HTML
 * document string that includes embedded CSS matching the app's preview
 * styling. Used by both the HTML export and the PDF print pathway.
 */
export function renderExportHtml(markdown: string, title: string): string {
  const bodyHtml = DOMPurify.sanitize(
    marked.parse(markdown, { breaks: true, gfm: true }) as string,
    {
      ALLOWED_TAGS: [
        "h1","h2","h3","h4","h5","h6","p","br","hr",
        "ul","ol","li","blockquote","pre","code",
        "strong","em","del","a","img","table","thead",
        "tbody","tr","th","td","sup","sub","span","div",
        "input",
      ],
      ALLOWED_ATTR: ["href","src","alt","title","class","id","rel","type","checked"],
    },
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
  body {
    max-width: 780px;
    margin: 2rem auto;
    padding: 0 1.5rem;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    font-size: 16px;
    line-height: 1.75;
    color: #1a1d23;
    background: #fff;
  }
  h1,h2,h3,h4,h5,h6 { font-weight: 700; line-height: 1.3; color: #111; margin: 1.6rem 0 0.6rem; }
  h1 { font-size: 1.85em; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.3em; }
  h2 { font-size: 1.45em; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.3em; }
  h3 { font-size: 1.2em; }
  h4 { font-size: 1.05em; }
  h5 { font-size: 0.95em; color: #666; }
  h6 { font-size: 0.875em; color: #666; }
  p { margin: 0.85em 0; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  blockquote { margin: 1em 0; padding: 0.5em 1.25em; border-left: 4px solid #2563eb; background: #f5f7fa; border-radius: 0 6px 6px 0; color: #555; font-style: italic; }
  pre { background: #f0f0f0; padding: 1.1rem 1.3rem; border-radius: 8px; overflow-x: auto; margin: 1em 0; font-size: 13px; }
  code { font-family: 'JetBrains Mono', 'Fira Code', monospace; }
  :not(pre) > code { background: #f0f0f0; padding: 0.15em 0.45em; border-radius: 4px; font-size: 0.875em; }
  img { max-width: 100%; border-radius: 6px; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ddd; padding: 0.5em 0.85em; }
  th { background: #f5f7fa; font-weight: 600; }
  hr { border: none; border-top: 2px solid #e0e0e0; margin: 1.5em 0; }
  input[type="checkbox"] { margin-right: 0.5em; accent-color: #2563eb; vertical-align: middle; }

  @media print {
    body { margin: 0; padding: 0.5in; max-width: none; }
    pre, blockquote { break-inside: avoid; }
    h1,h2,h3,h4 { break-after: avoid; }
  }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Extracts a document title from the filename or falls back to 'Untitled'.
 */
export function getExportTitle(filePath: string | null): string {
  if (!filePath) return "Untitled";
  const parts = filePath.split(/[\\/]/);
  const name = parts[parts.length - 1];
  return name.replace(/\.[^.]+$/, "") || name;
}

/**
 * Exports the rendered HTML as a .html file via save dialog.
 * Returns true on success, false if the user cancelled or an error occurred.
 */
export async function exportHtml(markdown: string, filePath: string | null): Promise<boolean> {
  try {
    const title = getExportTitle(filePath);
    const html = renderExportHtml(markdown, title);

    const savePath = await save({
      filters: [{ name: "HTML Document", extensions: ["html", "htm"] }],
      defaultPath: `${title}.html`,
    });
    if (!savePath) return false;

    await writeTextFile(savePath as string, html);
    return true;
  } catch (e) {
    console.error("HTML export failed:", e);
    return false;
  }
}

/**
 * Exports the raw markdown content as a .txt file via save dialog.
 * Returns true on success, false if the user cancelled or an error occurred.
 */
export async function exportTxt(markdown: string, filePath: string | null): Promise<boolean> {
  try {
    const title = getExportTitle(filePath);

    const savePath = await save({
      filters: [{ name: "Plain Text", extensions: ["txt"] }],
      defaultPath: `${title}.txt`,
    });
    if (!savePath) return false;

    await writeTextFile(savePath as string, markdown);
    return true;
  } catch (e) {
    console.error("TXT export failed:", e);
    return false;
  }
}

function inlineTokensToContent(tokens: Token[] | undefined): Content[] {
  if (!tokens) return [];
  const out: Content[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case "text": {
        const tt = t as Tokens.Text;
        if (tt.tokens) out.push(...inlineTokensToContent(tt.tokens));
        else out.push({ text: tt.text });
        break;
      }
      case "strong":
        out.push({ text: inlineTokensToContent((t as Tokens.Strong).tokens), bold: true });
        break;
      case "em":
        out.push({ text: inlineTokensToContent((t as Tokens.Em).tokens), italics: true });
        break;
      case "del":
        out.push({ text: inlineTokensToContent((t as Tokens.Del).tokens), decoration: "lineThrough" });
        break;
      case "codespan":
        out.push({ text: (t as Tokens.Codespan).text, style: "codespan" });
        break;
      case "link": {
        const lt = t as Tokens.Link;
        out.push({ text: inlineTokensToContent(lt.tokens), link: lt.href, color: "#2563eb", decoration: "underline" });
        break;
      }
      case "br":
        out.push({ text: "\n" });
        break;
      case "escape":
        out.push({ text: (t as Tokens.Escape).text });
        break;
      case "image": {
        const it = t as Tokens.Image;
        out.push({ text: `[${it.text || it.href}]`, italics: true, color: "#888" });
        break;
      }
      case "html":
        break;
      default: {
        const txt = (t as { text?: string }).text;
        if (txt) out.push({ text: txt });
      }
    }
  }
  return out;
}

function blockTokensToContent(tokens: Token[]): Content[] {
  const out: Content[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const h = token as Tokens.Heading;
        const depth = Math.min(Math.max(h.depth, 1), 6);
        out.push({ text: inlineTokensToContent(h.tokens), style: `h${depth}` });
        break;
      }
      case "paragraph": {
        const p = token as Tokens.Paragraph;
        out.push({ text: inlineTokensToContent(p.tokens), style: "paragraph" });
        break;
      }
      case "text": {
        const tt = token as Tokens.Text;
        if (tt.tokens) out.push({ text: inlineTokensToContent(tt.tokens) });
        else out.push({ text: tt.text });
        break;
      }
      case "list": {
        const l = token as Tokens.List;
        const items: Content[] = l.items.map((item) => {
          const inner = blockTokensToContent(item.tokens);
          const flat: Content = inner.length === 1 ? inner[0] : { stack: inner };
          if (item.task) {
            const marker = item.checked ? "☑  " : "☐  ";
            return { text: [{ text: marker }, flat] };
          }
          return flat;
        });
        out.push(l.ordered ? { ol: items } : { ul: items });
        break;
      }
      case "code": {
        const c = token as Tokens.Code;
        out.push({ text: c.text, style: "code", preserveLeadingSpaces: true });
        break;
      }
      case "blockquote": {
        const b = token as Tokens.Blockquote;
        out.push({ stack: blockTokensToContent(b.tokens), style: "blockquote", margin: [12, 4, 0, 4] });
        break;
      }
      case "hr":
        out.push({
          canvas: [{ type: "line", x1: 0, y1: 5, x2: 495, y2: 5, lineWidth: 0.5, lineColor: "#cccccc" }],
          margin: [0, 6, 0, 6],
        });
        break;
      case "table": {
        const tbl = token as Tokens.Table;
        const header = tbl.header.map((cell) => ({
          text: inlineTokensToContent(cell.tokens),
          style: "tableHeader",
          alignment: (cell.align ?? undefined) as "left" | "center" | "right" | undefined,
        }));
        const body = tbl.rows.map((row) =>
          row.map((cell) => ({
            text: inlineTokensToContent(cell.tokens),
            alignment: (cell.align ?? undefined) as "left" | "center" | "right" | undefined,
          })),
        );
        out.push({
          table: {
            headerRows: 1,
            widths: Array(tbl.header.length).fill("*"),
            body: [header, ...body] as Content[][],
          },
          layout: "lightHorizontalLines",
          margin: [0, 6, 0, 6],
        });
        break;
      }
      case "space":
      case "html":
      case "def":
        break;
      default: {
        const txt = (token as { text?: string }).text;
        if (txt) out.push({ text: txt });
      }
    }
  }
  return out;
}

function buildPdfDocDefinition(markdown: string, title: string): TDocumentDefinitions {
  const tokens = marked.lexer(markdown);
  return {
    info: { title },
    content: blockTokensToContent(tokens),
    defaultStyle: { font: "Roboto", fontSize: 11, lineHeight: 1.4, color: "#1a1d23" },
    pageMargins: [50, 50, 50, 50],
    styles: {
      h1: { fontSize: 22, bold: true, color: "#111", margin: [0, 12, 0, 6] },
      h2: { fontSize: 18, bold: true, color: "#111", margin: [0, 10, 0, 6] },
      h3: { fontSize: 15, bold: true, color: "#111", margin: [0, 8, 0, 4] },
      h4: { fontSize: 13, bold: true, color: "#111", margin: [0, 6, 0, 4] },
      h5: { fontSize: 11, bold: true, color: "#666", margin: [0, 4, 0, 2] },
      h6: { fontSize: 10, bold: true, color: "#666", margin: [0, 4, 0, 2] },
      paragraph: { margin: [0, 4, 0, 4] },
      code: { fontSize: 9.5, background: "#f0f0f0", margin: [0, 4, 0, 4] },
      codespan: { background: "#f0f0f0" },
      blockquote: { color: "#555", italics: true },
      tableHeader: { bold: true, fillColor: "#f5f7fa" },
    },
  };
}

/**
 * Generates a vector PDF from the document via pdfmake and writes it to a
 * user-chosen path. Output is real selectable text (not a rasterized snapshot).
 */
export async function exportPdf(markdown: string, filePath: string | null): Promise<boolean> {
  try {
    const title = getExportTitle(filePath);

    const savePath = await save({
      filters: [{ name: "PDF Document", extensions: ["pdf"] }],
      defaultPath: `${title}.pdf`,
    });
    if (!savePath) return false;

    const docDef = buildPdfDocDefinition(markdown, title);
    const pdfMake = await loadPdfMake();
    const blob = await pdfMake.createPdf(docDef).getBlob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await writeFile(savePath as string, bytes);
    return true;
  } catch (e) {
    console.error("PDF export failed:", e);
    return false;
  }
}