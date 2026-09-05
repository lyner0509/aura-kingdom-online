/**
 * Tiny Markdown renderer for Aura Kingdom dispatches.
 *
 * Supports: headings, bold, italic, inline code, links, images,
 * bullet and numbered lists, blockquotes, horizontal rules, paragraphs.
 *
 * All input is HTML-escaped BEFORE any markup is generated, so a post
 * body can never inject script or arbitrary tags into the page.
 */
window.AKMarkdown = (function () {
  "use strict";

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Only allow links we are sure about — no javascript: or data: URLs.
  function safeUrl(url) {
    const clean = String(url).trim();
    return /^(https?:\/\/|\/|mailto:|#)/i.test(clean) ? clean : "#";
  }

  function inline(text) {
    return text
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
        (_m, alt, src) => `<img src="${safeUrl(src)}" alt="${alt}" loading="lazy">`)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
        (_m, label, href) => `<a href="${safeUrl(href)}">${label}</a>`)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  }

  function render(markdown) {
    const lines = escapeHtml(markdown || "").replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let list = null;      // "ul" | "ol" | null
    let paragraph = [];
    let quote = [];

    const flushParagraph = () => {
      if (paragraph.length) {
        out.push(`<p>${inline(paragraph.join(" "))}</p>`);
        paragraph = [];
      }
    };
    const flushList = () => {
      if (list) { out.push(`</${list}>`); list = null; }
    };
    const flushQuote = () => {
      if (quote.length) {
        out.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
        quote = [];
      }
    };
    const flushAll = () => { flushParagraph(); flushList(); flushQuote(); };

    for (const raw of lines) {
      const line = raw.trim();

      if (!line) { flushAll(); continue; }

      const heading = line.match(/^(#{1,4})\s+(.*)$/);
      if (heading) {
        flushAll();
        const level = heading[1].length + 1; // h1 is the post title
        out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        continue;
      }

      if (/^(---+|\*\*\*+)$/.test(line)) { flushAll(); out.push("<hr>"); continue; }

      const bullet = line.match(/^[-*]\s+(.*)$/);
      const numbered = line.match(/^\d+\.\s+(.*)$/);
      if (bullet || numbered) {
        flushParagraph(); flushQuote();
        const want = bullet ? "ul" : "ol";
        if (list !== want) { flushList(); out.push(`<${want}>`); list = want; }
        out.push(`<li>${inline((bullet || numbered)[1])}</li>`);
        continue;
      }

      const quoted = line.match(/^&gt;\s?(.*)$/);
      if (quoted) { flushParagraph(); flushList(); quote.push(quoted[1]); continue; }

      flushList(); flushQuote();
      paragraph.push(line);
    }

    flushAll();
    return out.join("\n");
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
            .toUpperCase();
  }

  return { render, escapeHtml, safeUrl, formatDate };
})();
