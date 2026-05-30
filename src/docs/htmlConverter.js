import path from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import JSZip from "jszip";

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll("\"", "&quot;")
  .replaceAll("'", "&#39;");

const toHtmlShell = (title, bodyHtml, { monospace = false } = {}) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      body {
        margin: 0;
        padding: 1rem 1.25rem;
        font: 16px/1.45 ${monospace ? '"Consolas", "Menlo", "Monaco", "Courier New", monospace' : '"Inter", "Segoe UI", system-ui, sans-serif'};
        color: #111;
        background: #fff;
      }
      p, li, div, span {
        font-family: ${monospace ? '"Consolas", "Menlo", "Monaco", "Courier New", monospace' : 'inherit'};
        white-space: pre-wrap;
        tab-size: 4;
      }
      img {
        max-width: 100%;
        height: auto;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>
`;

const docxUsesConsolLikeFont = async (buffer) => {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const candidateFiles = ["word/fontTable.xml", "word/styles.xml", "word/document.xml"];
    const chunks = await Promise.all(candidateFiles.map(async (name) => {
      const entry = zip.file(name);
      if (!entry) {
        return "";
      }

      return entry.async("string");
    }));

    const combined = chunks.join("\n").toLowerCase();
    return combined.includes("consol");
  } catch {
    return false;
  }
};

const convertDocxToHtml = async (buffer, fileName, { forceMonospace = false } = {}) => {
  const useMonospace = forceMonospace || await docxUsesConsolLikeFont(buffer);
  const result = await mammoth.convertToHtml({ buffer });
  return toHtmlShell(fileName, result.value || "<p></p>", { monospace: useMonospace });
};

const convertPdfToHtml = async (buffer, fileName, { forceMonospace = false } = {}) => {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  const lines = (result.text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const body = lines.length > 0
    ? `<pre>${escapeHtml(lines.join("\n"))}</pre>`
    : "<p>No extractable text found in PDF.</p>";

  return toHtmlShell(fileName, body, { monospace: forceMonospace });
};

export const convertAttachmentToHtml = async ({ buffer, originalName, forceMonospace = false }) => {
  const ext = path.extname(originalName || "").toLowerCase();
  if (ext === ".docx") {
    return convertDocxToHtml(buffer, originalName || "Document", { forceMonospace });
  }

  if (ext === ".pdf") {
    return convertPdfToHtml(buffer, originalName || "PDF", { forceMonospace });
  }

  return null;
};
