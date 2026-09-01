const ALLOWED_RICH_TEXT_TAGS = new Set([
  'B',
  'BR',
  'DIV',
  'EM',
  'I',
  'LI',
  'OL',
  'P',
  'S',
  'SPAN',
  'STRONG',
  'SUB',
  'SUP',
  'U',
  'UL',
]);

const FORBIDDEN_SVG_TAGS = new Set([
  'audio',
  'embed',
  'foreignobject',
  'iframe',
  'image',
  'object',
  'script',
  'video',
]);

const unwrapElement = (element: Element) => {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
};

export const sanitizeRichText = (html: string): string => {
  const template = document.createElement('template');
  template.innerHTML = html;

  const elements = Array.from(template.content.querySelectorAll('*')).reverse();
  for (const element of elements) {
    if (!ALLOWED_RICH_TEXT_TAGS.has(element.tagName)) {
      unwrapElement(element);
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      element.removeAttribute(attribute.name);
    }
  }

  return template.innerHTML;
};

export const richTextToPlainText = (html: string): string => {
  const template = document.createElement('template');
  template.innerHTML = sanitizeRichText(html);
  return (template.content.textContent || '').replace(/\s+/g, ' ').trim();
};

export const sanitizeMermaidSource = (source: string): string => source
  .slice(0, 12_000)
  .split('\n')
  .filter(line => !/^\s*%%\{/.test(line) && !/^\s*click\s+/i.test(line))
  .join('\n')
  .replace(/<[^>]*>/g, '')
  .replace(/(?:javascript|vbscript)\s*:/gi, 'blocked:')
  .replace(/data\s*:(?=\s*(?:text\/html|image\/svg\+xml))/gi, 'blocked:');

export const sanitizeMermaidSvg = (svg: string): string => {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(svg, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) {
    throw new Error('Mermaid produced invalid SVG.');
  }

  for (const element of Array.from(documentNode.querySelectorAll('*'))) {
    if (element.tagName.toLowerCase() === 'a') {
      unwrapElement(element);
      continue;
    }
    if (FORBIDDEN_SVG_TAGS.has(element.tagName.toLowerCase())) {
      element.remove();
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      const isLinkAttribute = name === 'href' || name === 'xlink:href';
      const hasUnsafeCssUrl = /url\s*\(\s*(?!#)[^)]+\)/i.test(value);
      if (
        name.startsWith('on') ||
        (isLinkAttribute && !value.startsWith('#')) ||
        /(?:javascript|vbscript|data)\s*:/i.test(value) ||
        hasUnsafeCssUrl ||
        /(?:expression\s*\(|@import)/i.test(value)
      ) {
        element.removeAttribute(attribute.name);
      }
    }

    if (
      element.tagName.toLowerCase() === 'style' &&
      (/@import/i.test(element.textContent || '') || /url\s*\(\s*(?!#)[^)]+\)/i.test(element.textContent || ''))
    ) {
      element.remove();
    }
  }

  return new XMLSerializer().serializeToString(documentNode.documentElement);
};
