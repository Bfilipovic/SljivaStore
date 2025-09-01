export function linkifyMarkdown(input: string): string {
  // Escape everything first
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // Whitelist of safe protocols
  const isSafeUrl = (url: string) =>
    /^(https?:\/\/|www\.)/i.test(url);

  let safe = escapeHtml(input);

  // Step 1: Markdown-style [text](url)
  safe = safe.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)/g,
    (match, text, url) => {
      if (!isSafeUrl(url)) return text; // drop unsafe link
      const href = url.startsWith("http") ? url : `http://${url}`;
      return `<a href="${href}" class="text-blue-500 underline" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }
  );

  // Step 2: Raw URLs (http, https, www)
  safe = safe.replace(
    /(?:https?:\/\/[^\s]+|www\.[^\s]+)/g,
    (url) => {
      if (!isSafeUrl(url)) return url; // leave as plain text
      const href = url.startsWith("http") ? url : `http://${url}`;
      return `<a href="${href}" class="text-blue-500 underline" target="_blank" rel="noopener noreferrer">${url}</a>`;
    }
  );

  return safe;
}


export function shorten(addr: string, chars = 6) {
  if (!addr) return "";
  return addr.length > chars * 2
    ? addr.slice(0, chars) + "…" + addr.slice(-chars)
    : addr;
}
