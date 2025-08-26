export function linkifyMarkdown(input: string): string {
  return input.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" class="text-blue-500 underline" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}


export function shorten(addr: string, chars = 6) {
  if (!addr) return "";
  return addr.length > chars * 2
    ? addr.slice(0, chars) + "…" + addr.slice(-chars)
    : addr;
}
