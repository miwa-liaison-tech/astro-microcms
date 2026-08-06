interface RubyWord {
  surface?: string;
  furigana?: string;
  subword?: RubyWord[];
}

interface FuriganaResponse {
  result?: {
    word?: RubyWord[];
  };
  error?: {
    message?: string;
  };
}

interface FuriganaApi {
  setProxyUrl(url: string): void;
  setDefaultGrade(grade: number): void;
  toRubyHtml(text: string, grade?: number): Promise<string>;
  applyToElement(element: Element | null, grade?: number): Promise<void>;
  applyToElements(elements: Iterable<Element>, grade?: number): Promise<void>;
  applyToTextNodes(element: Element | null, grade?: number): Promise<void>;
}

declare global {
  interface Window {
    Furigana?: FuriganaApi;
  }
}

const DEFAULT_PROXY_URL = "https://furigana-proxy.takafumi-miwa.workers.dev";
const MAX_QUERY_BYTES = 3000;
let proxyUrl = import.meta.env.PUBLIC_FURIGANA_PROXY_URL || DEFAULT_PROXY_URL;
let defaultGrade = 1;
const rubyCache = new Map<string, Promise<string>>();

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hasKanji(value: string) {
  return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/u.test(value);
}

function needsRuby(surface: string, furigana?: string) {
  return Boolean(furigana && surface !== furigana && hasKanji(surface));
}

function isUnsupportedCharacter(value: string) {
  return /[\u{1f000}-\u{1faff}\u{2600}-\u{27bf}\u{fe00}-\u{fe0f}\u{200d}]/u.test(value);
}

function buildRubyHtml(words: RubyWord[]) {
  return words
    .map((word) => {
      if (!word.surface) return "";

      if (word.subword?.length) {
        return word.subword
          .map((subword) => {
            if (!subword.surface) return "";
            return needsRuby(subword.surface, subword.furigana)
              ? `<ruby>${escapeHtml(subword.surface)}<rt>${escapeHtml(subword.furigana ?? "")}</rt></ruby>`
              : escapeHtml(subword.surface);
          })
          .join("");
      }

      return needsRuby(word.surface, word.furigana)
        ? `<ruby>${escapeHtml(word.surface)}<rt>${escapeHtml(word.furigana ?? "")}</rt></ruby>`
        : escapeHtml(word.surface);
    })
    .join("");
}

function splitText(text: string) {
  const chunks: Array<{ text?: string; raw?: string }> = [];
  const encoder = new TextEncoder();
  let current = "";

  const flush = () => {
    if (current) chunks.push({ text: current });
    current = "";
  };

  for (const character of Array.from(text)) {
    if (isUnsupportedCharacter(character)) {
      flush();
      chunks.push({ raw: character });
      continue;
    }

    const candidate = current + character;
    if (current && encoder.encode(candidate).byteLength > MAX_QUERY_BYTES) {
      flush();
    }
    current += character;
  }

  flush();
  return chunks;
}

async function fetchRubyChunk(text: string, grade: number) {
  if (!text || !hasKanji(text)) return escapeHtml(text);

  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, grade }),
  });
  const data = (await response.json()) as FuriganaResponse;

  if (!response.ok) {
    throw new Error(data.error?.message || `Furigana API error: ${response.status}`);
  }
  if (data.error) {
    throw new Error(data.error.message || "Furigana API error");
  }
  if (!data.result?.word) return escapeHtml(text);

  return buildRubyHtml(data.result.word);
}

async function toRubyHtml(text: string, grade: number) {
  if (!text) return "";

  const cacheKey = `${grade}:${text}`;
  const cached = rubyCache.get(cacheKey);
  if (cached) return cached;

  const request = (async () => {
    let html = "";
    for (const chunk of splitText(text)) {
      html += chunk.raw ? escapeHtml(chunk.raw) : await fetchRubyChunk(chunk.text ?? "", grade);
    }
    return html;
  })();

  rubyCache.set(cacheKey, request);
  try {
    return await request;
  } catch (error) {
    rubyCache.delete(cacheKey);
    throw error;
  }
}

async function applyToElement(element: Element | null, grade: number) {
  if (!element) return;
  const text = element.textContent?.trim() ?? "";
  if (!text) return;

  try {
    element.innerHTML = await toRubyHtml(text, grade);
  } catch (error) {
    console.error("ふりがなの取得に失敗しました:", error);
  }
}

async function applyToElements(elements: Iterable<Element>, grade: number) {
  await Promise.all(
    Array.from(elements, (element) =>
      element.children.length > 0
        ? applyToTextNodes(element, grade)
        : applyToElement(element, grade),
    ),
  );
}

async function applyToTextNodes(element: Element | null, grade: number) {
  if (!element) return;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      const text = node.textContent ?? "";
      if (!parent || !text.trim() || ["SCRIPT", "STYLE", "RUBY", "RT"].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const textNodes: Text[] = [];
  let node = walker.nextNode();

  while (node) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }

  for (const textNode of textNodes) {
    try {
      const html = await toRubyHtml(textNode.textContent ?? "", grade);
      const template = document.createElement("template");
      template.innerHTML = html;
      textNode.parentNode?.replaceChild(template.content, textNode);
    } catch (error) {
      console.error("ふりがなの適用に失敗しました:", error);
    }
  }
}

const Furigana: FuriganaApi = {
  setProxyUrl(url) {
    if (url.trim()) proxyUrl = url.trim();
  },
  setDefaultGrade(grade) {
    defaultGrade = Math.min(8, Math.max(1, Math.trunc(grade)));
  },
  toRubyHtml(text, grade = defaultGrade) {
    return toRubyHtml(String(text), grade);
  },
  applyToElement(element, grade = defaultGrade) {
    return applyToElement(element, grade);
  },
  applyToElements(elements, grade = defaultGrade) {
    return applyToElements(elements, grade);
  },
  applyToTextNodes(element, grade = defaultGrade) {
    return applyToTextNodes(element, grade);
  },
};

window.Furigana = Furigana;

function initializeFurigana() {
  void Furigana.applyToElements(
    document.querySelectorAll(".js-furigana, .header__nav-link, .nav-menu__link, .footer__copyright"),
  );
  document.querySelectorAll(".entry__body, .webinar-card__body-content, .webinar-detail__body-content").forEach((element) => {
    void Furigana.applyToTextNodes(element);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeFurigana, { once: true });
} else {
  initializeFurigana();
}

export {};
