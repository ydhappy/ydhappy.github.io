const API_URL = "https://api.github.com/search/repositories";
const PAGE_SIZE = 30;

const form = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const filters = document.querySelector(".language-filters");
const grid = document.querySelector("#repo-grid");
const summary = document.querySelector("#results-summary");
const updated = document.querySelector("#last-updated");
const loadMoreButton = document.querySelector("#load-more");
const resultsNote = document.querySelector("#results-note");
const savingsGrid = document.querySelector("#savings-grid");
const savingsNote = document.querySelector("#savings-note");
const savingsSummary = document.querySelector("#savings-summary");
const savingsCategories = document.querySelector(".savings-categories");
const savingsLoadMoreButton = document.querySelector("#savings-load-more");
const mediaGrid = document.querySelector("#media-grid");
const mediaNote = document.querySelector("#media-note");
const mediaSummary = document.querySelector("#media-summary");
const mediaMajorCategory = document.querySelector("#media-major-category");
const mediaMiddleCategory = document.querySelector("#media-middle-category");
const mediaSmallCategory = document.querySelector("#media-small-category");
const mediaMenuToggle = document.querySelector("#media-menu-toggle");
const mediaCategoryPanel = document.querySelector("#media-category-panel");
const mediaMenuCurrent = document.querySelector("#media-menu-current");
const mediaLoadMoreButton = document.querySelector("#media-load-more");

let activeLanguage = "";
let searchTerm = "";
let currentPage = 1;
let totalCount = 0;
let requestController;
let savingsPage = 1;
let savingsTotalCount = 0;
let savingsRequestController;
let activeSavingsQuery = '"context compression"';
let mediaPage = 1;
let mediaTotalCount = 0;
let mediaRequestController;
let activeMediaQuery = '"image generation"';
let activeMediaDescription = "Stable Diffusion 등 오픈소스 이미지 생성 모델과 도구입니다.";
const mediaCategoryTree = [
  {
    name: "이미지 제작",
    categories: [
      {
        name: "이미지 생성",
        items: [
          { name: "텍스트로 이미지 만들기", query: '"text to image"', description: "텍스트 프롬프트로 이미지를 생성하는 오픈소스 모델과 도구입니다." },
          { name: "Stable Diffusion", query: '"stable diffusion"', description: "Stable Diffusion 기반의 이미지 생성 모델과 프로젝트입니다." },
          { name: "이미지 생성 UI·워크플로", query: '"image generation" UI OR workflow', description: "이미지 생성 과정을 구성하고 실행하는 UI와 워크플로 도구입니다." }
        ]
      },
      {
        name: "이미지 편집",
        items: [
          { name: "인페인팅·아웃페인팅", query: '"image inpainting" OR outpainting', description: "이미지 일부를 수정하거나 캔버스를 확장하는 도구입니다." },
          { name: "이미지 업스케일", query: '"image upscaling" AI', description: "AI로 이미지 해상도와 세부 묘사를 높이는 도구입니다." }
        ]
      }
    ]
  },
  {
    name: "영상 제작",
    categories: [
      {
        name: "텍스트·이미지로 영상 생성",
        items: [
          { name: "텍스트→영상", query: '"text to video" generation', description: "텍스트 프롬프트에서 영상을 생성하는 오픈소스 프로젝트입니다." },
          { name: "이미지→영상", query: '"image to video" generation', description: "정지 이미지를 짧은 영상이나 움직이는 장면으로 만드는 도구입니다." }
        ]
      },
      {
        name: "영상 제작·편집",
        items: [
          { name: "생성형 영상 모델", query: '"video generation" model', description: "생성형 AI 영상 모델과 추론 구현을 찾아봅니다." },
          { name: "영상 편집 자동화", query: '"AI video editing" open source', description: "AI를 활용해 영상 편집을 자동화하거나 보조하는 프로젝트입니다." }
        ]
      }
    ]
  },
  {
    name: "음악 기반 영상",
    categories: [
      {
        name: "음악 시각화",
        items: [
          { name: "오디오 반응 비주얼라이저", query: '"audio visualizer" music', description: "음악의 주파수와 박자에 반응하는 오픈소스 비주얼라이저입니다." },
          { name: "뮤직비디오 생성", query: '"music video generator" open source', description: "음악에 맞춘 비주얼과 뮤직비디오 제작을 돕는 프로젝트입니다." }
        ]
      }
    ]
  },
  {
    name: "쇼츠 제작",
    categories: [
      {
        name: "짧은 영상 편집",
        items: [
          { name: "긴 영상에서 쇼츠 추출", query: '"long video to shorts" OR "AI clipping"', description: "긴 영상에서 주요 장면을 찾아 짧은 세로형 클립을 만드는 도구입니다." },
          { name: "자막·세로형 편집", query: '"short form video" subtitles editor', description: "쇼츠용 자막, 화면 재구성, 세로형 편집을 지원합니다." }
        ]
      }
    ]
  }
];
const readmeSummaries = new Map();
const repositoryFiles = new Map();
const descriptionTranslations = new Map();
let browserTranslatorPromise;
let browserTranslationQueue = Promise.resolve();

const numberFormat = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric" });

function formatStars(count) {
  return numberFormat.format(count);
}

function formatUpdatedAt(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "업데이트 날짜 없음" : `업데이트 ${dateFormat.format(date)}`;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function getRepositoryType(repository) {
  const topics = repository.topics || [];
  const text = `${repository.name} ${repository.description || ""} ${topics.join(" ")}`.toLowerCase();
  const hasTopic = (...values) => values.some((value) => topics.includes(value));

  if (/\b(prompt|context|token)[ -]?(compression|optimization|optimisation)|\b(prompt cache|llm cost|cost tracking)\b/.test(text)) return "토큰·비용 최적화";
  if (hasTopic("music-visualizer", "audio-visualizer") || /\b(music visuali[sz]er|audio visuali[sz]er)\b/.test(text)) return "음악 시각화";
  if (hasTopic("text-to-video", "video-generation") || /\b(text.to.video|video generation|video diffusion|image.to.video)\b/.test(text)) return "AI 영상 생성";
  if (hasTopic("image-generation", "text-to-image", "stable-diffusion") || /\b(image generation|text.to.image|stable diffusion)\b/.test(text)) return "AI 이미지 생성";
  if (/\b(shorts editor|short.video editor|vertical video)\b/.test(text)) return "쇼츠 편집";
  if (hasTopic("music-visualizer", "audio-visualizer") || /\b(music visuali[sz]er|audio visuali[sz]er)\b/.test(text)) return "음악 시각화";
  if (hasTopic("text-to-video", "video-generation") || /\b(text.to.video|video generation|video diffusion|image.to.video)\b/.test(text)) return "AI 영상 생성";
  if (hasTopic("image-generation", "text-to-image", "stable-diffusion") || /\b(image generation|text.to.image|stable diffusion)\b/.test(text)) return "AI 이미지 생성";
  if (/\b(shorts editor|short.video editor|vertical video)\b/.test(text)) return "쇼츠 편집";
  if (hasTopic("coding-agent", "ai-coding-agent") || /\b(coding agent|code agent)\b/.test(text)) return "코딩 에이전트";
  if (hasTopic("ai-agent", "agents", "agentic-ai") || /\b(ai agent|agentic|autonomous agent|multi-agent|mcp server)\b/.test(text)) return "AI 에이전트";
  if (hasTopic("machine-learning", "deep-learning", "llm") || /\b(machine learning|deep learning|large language model|llm|inference)\b/.test(text)) return "AI·ML";
  if (hasTopic("rag", "vector-database") || /\b(rag|retrieval augmented|vector database|embedding)\b/.test(text)) return "데이터·RAG";
  if (hasTopic("developer-tools", "cli", "devtools") || /\b(developer tool|command.line|terminal|code editor|developer experience)\b/.test(text)) return "개발 도구";
  if (hasTopic("framework", "library") || /\b(framework|library|sdk)\b/.test(text)) return "라이브러리·프레임워크";
  if (hasTopic("web", "web-application") || /\b(web app|web application|frontend|backend)\b/.test(text)) return "웹·앱";
  return "기타";
}

const summaryLabels = {
  ko: {
    description: "저장소 설명",
    overview: "프로젝트 개요",
    features: "주요 기능",
    usage: "사용 방법",
    fallback: "한국어 README가 없어 저장소의 기본 README 원문을 표시합니다.",
    loading: "README에서 개요·기능·사용 방법을 확인하고 있습니다.",
    translating: "브라우저 내장 한국어 번역기를 준비하고 있습니다.",
    translated: "브라우저 내장 번역기로 영어 요약을 한국어로 번역했습니다.",
    translationError: "한국어 자동 번역에 실패했습니다. 아래는 영어 원문 요약입니다. English를 누르거나 다시 시도할 수 있습니다.",
    descriptionTranslating: "한국어로 번역 중…",
    descriptionTranslate: "한국어 번역 보기",
    descriptionOriginal: "English 원문",
    descriptionRetry: "한국어 번역 다시 시도",
    browserUnavailable: "이 브라우저는 내장 번역 API를 지원하지 않습니다. Chrome 또는 Edge의 페이지 번역 기능을 이용해 주세요."
  },
  en: {
    description: "Repository description",
    overview: "Project overview",
    features: "Key features",
    usage: "How to use",
    fallback: "No English README was found; showing the repository's default README.",
    loading: "Reading the README overview, features, and usage.",
    translating: "Preparing the browser's built-in Korean translator.",
    translated: "English summary sections were translated to Korean with the browser's built-in translator.",
    translationError: "Korean translation failed. The English source summary is shown below. Switch to English or retry.",
    descriptionTranslating: "Translating to Korean…",
    descriptionTranslate: "한국어 번역",
    descriptionOriginal: "English original",
    descriptionRetry: "Retry Korean translation",
    browserUnavailable: "This browser does not support the built-in Translator API. Use Chrome or Edge's page translation."
  }
};

function cleanMarkdownBlock(block) {
  return block
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<details[\s\S]*?<\/details>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+[.)]\s+/gm, "• ")
    .replace(/^\s*[-*_]{3,}\s*$/gm, "")
    .replace(/[`*_~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenText(text, maximum = 320) {
  if (text.length <= maximum) return text;
  const shortened = text.slice(0, maximum);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > maximum * 0.6 ? lastSpace : maximum).trim()}…`;
}

function detectTextLanguage(text) {
  const hangulCount = (text.match(/[가-힣]/g) || []).length;
  const letterCount = (text.match(/[a-zA-Z가-힣]/g) || []).length;
  return hangulCount > 0 && hangulCount / Math.max(letterCount, 1) >= 0.3 ? "ko" : "en";
}

function getSectionLabel(heading, language) {
  const normalized = heading.toLowerCase();
  const labels = summaryLabels[language];
  if (/what is|about|overview|introduction|소개|개요|프로젝트/.test(normalized)) return labels.overview;
  if (/feature|capabilit|기능/.test(normalized)) return labels.features;
  if (/usage|getting started|quick start|installation|install|example|사용법|사용 방법|시작|설치|예제/.test(normalized)) return labels.usage;
  return language === "en" ? heading : `README: ${heading}`;
}

function extractReadmeSummary(markdown, repository, language, sourceLanguage) {
  const content = markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<details[\s\S]*?<\/details>/gi, "");
  const sections = [];
  let current = { heading: "", body: "", level: 0 };

  for (const line of content.split("\n")) {
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      sections.push(current);
      current = { heading: cleanMarkdownBlock(heading[2]), body: "", level: heading[1].length };
    } else {
      current.body += `${line}\n`;
    }
  }
  sections.push(current);

  const skipSection = /^(table of contents|contents|목차|license|licen[cs]e|contributing|contributors|authors|acknowledg(e)?ments|기여|라이선스|credits|support|지원)$/i;
  const parsed = sections
    .filter((section) => !skipSection.test(section.heading))
    .map((section) => {
      const blocks = section.body
        .split(/\n\s*\n/)
        .filter((block) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(block))
        .map(cleanMarkdownBlock)
        .filter((text) => text.length >= 24);
      return { heading: section.heading, level: section.level, text: shortenText(blocks.slice(0, 3).join(" "), 320) };
    })
    .filter((section) => section.text);

  const labels = summaryLabels[language];
  const result = [];
  const description = repository.description?.trim();
  if (description) result.push({ label: labels.description, text: shortenText(description) });

  const intro = parsed.find((section) => !section.heading)?.text
    ? parsed.find((section) => !section.heading)
    : parsed.find((section) => section.level === 1);
  if (intro && !result.some((item) => item.text === intro.text)) {
    result.push({ label: labels.overview, text: intro.text });
  }

  const rankedSections = parsed
    .filter((section) => section.heading && section !== intro)
    .sort((left, right) => sectionPriority(left.heading) - sectionPriority(right.heading));

  for (const section of rankedSections) {
    const label = getSectionLabel(section.heading, language);
    if (result.some((item) => item.label === label)) continue;
    result.push({ label, text: section.text });
    if (result.length >= 4) break;
  }

  if (!result.length) throw new Error("README에서 프로젝트 설명이나 기능 내용을 찾지 못했습니다.");
  return result;
}

function sectionPriority(heading) {
  if (/what is|about|overview|introduction|소개|개요|프로젝트/i.test(heading)) return 0;
  if (/feature|capabilit|기능/i.test(heading)) return 1;
  if (/usage|getting started|quick start|installation|install|example|사용법|시작|설치|예제/i.test(heading)) return 2;
  return 3;
}

function decodeReadmeContent(readme) {
  if (readme.encoding !== "base64" || typeof readme.content !== "string") {
    throw new Error("README 내용을 읽을 수 없는 형식입니다.");
  }
  const bytes = Uint8Array.from(atob(readme.content.replace(/\s/g, "")), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function getRepositoryFiles(fullName) {
  if (!repositoryFiles.has(fullName)) {
    const request = fetch(`https://api.github.com/repos/${fullName}/contents`, {
      headers: { Accept: "application/vnd.github+json" }
    }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(response, payload));
      return payload;
    });
    repositoryFiles.set(fullName, request);
    request.catch(() => repositoryFiles.delete(fullName));
  }
  return repositoryFiles.get(fullName);
}

async function fetchReadmeFile(repository, language) {
  const fullName = repository.full_name || `${repository.owner.login}/${repository.name}`;
  const cacheKey = `${fullName}:${language}`;
  if (!readmeSummaries.has(cacheKey)) {
    const request = (async () => {
      let readme;
      let localized = false;
      const files = await getRepositoryFiles(fullName);
      const languagePattern = language === "ko" ? /[._-](?:ko|kr)(?:[-_][a-z]{2})?\./i : /[._-]en(?:[-_][a-z]{2})?\./i;
      const localizedReadme = files.find((file) => (
        file.type === "file" && /^readme(?:[._-][a-z]{2}(?:[-_][a-z]{2})?)?\.md$/i.test(file.name)
        && languagePattern.test(file.name)
      ));

      if (localizedReadme) {
        const localizedResponse = await fetch(localizedReadme.url, {
          headers: { Accept: "application/vnd.github+json" }
        });
        readme = await localizedResponse.json();
        if (!localizedResponse.ok) throw new Error(errorMessage(localizedResponse, readme));
        localized = true;
      }

      if (!readme) {
        const response = await fetch(`https://api.github.com/repos/${fullName}/readme`, {
          headers: { Accept: "application/vnd.github+json" }
        });
        readme = await response.json();
        if (!response.ok) throw new Error(errorMessage(response, readme));
      }

      const markdown = decodeReadmeContent(readme);
      const sourceLanguage = localized ? language : detectTextLanguage(markdown);
      const fallback = !localized && sourceLanguage !== language;
      return {
        sections: extractReadmeSummary(markdown, repository, language, sourceLanguage),
        sourceLanguage,
        fallback
      };
    })();
    readmeSummaries.set(cacheKey, request);
    request.catch(() => readmeSummaries.delete(cacheKey));
  }
  return readmeSummaries.get(cacheKey);
}

function getBrowserTranslator() {
  if (!browserTranslatorPromise) {
    if (typeof globalThis.Translator?.create !== "function") {
      return Promise.reject(new Error(summaryLabels.ko.browserUnavailable));
    }
    try {
      browserTranslatorPromise = Promise.resolve(globalThis.Translator.create({
        sourceLanguage: "en",
        targetLanguage: "ko"
      }));
    } catch (error) {
      browserTranslatorPromise = Promise.reject(error);
    }
    browserTranslatorPromise.catch(() => {
      browserTranslatorPromise = undefined;
    });
  }
  return browserTranslatorPromise;
}

async function translateSummaryToKorean(summary) {
  const pendingTranslations = [];
  for (const [sectionIndex, section] of summary.sections.entries()) {
    if (detectTextLanguage(section.label) !== "ko") {
      pendingTranslations.push({ sectionIndex, field: "label", text: section.label });
    }
    if (detectTextLanguage(section.text) !== "ko") {
      pendingTranslations.push({ sectionIndex, field: "text", text: section.text });
    }
  }
  if (!pendingTranslations.length) return { ...summary, fallback: false, translated: false };

  const translated = await queueBrowserTranslation(pendingTranslations.map((item) => item.text));

  const sections = summary.sections.map((section) => ({ ...section }));
  translated.forEach((translatedText, index) => {
    const target = pendingTranslations[index];
    if (target.field === "text" && detectTextLanguage(translatedText) !== "ko") {
      throw new Error("일부 요약 항목이 한국어로 번역되지 않았습니다. 다시 시도해 주세요.");
    }
    sections[target.sectionIndex][target.field] = translatedText;
  });
  return { ...summary, sections, fallback: false, translated: true, translatedCount: pendingTranslations.length };
}

function queueBrowserTranslation(texts) {
  const result = browserTranslationQueue.then(async () => {
    let translator;
    try {
      translator = await getBrowserTranslator();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`브라우저 번역기를 사용할 수 없습니다: ${reason}`);
    }

    const translatedTexts = [];
    for (const text of texts) {
      try {
        const translated = await translator.translate(text);
        if (typeof translated !== "string" || !translated.trim()) {
          throw new Error("번역 결과가 비어 있습니다.");
        }
        translatedTexts.push(translated.trim());
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`브라우저 내장 번역 실행에 실패했습니다: ${reason}`);
      }
    }
    return translatedTexts;
  });
  browserTranslationQueue = result.catch(() => []);
  return result;
}

function getDescriptionTranslationKey(repository, text) {
  const fullName = repository.full_name || `${repository.owner.login}/${repository.name}`;
  return `${fullName}:${text}`;
}

async function translateVisibleDescriptions(descriptions) {
  const pending = descriptions.filter((description) => (
    description.dataset.translated !== "true" && description.dataset.translating !== "true"
  ));
  if (!pending.length) return;

  pending.forEach((description) => {
    description.dataset.translating = "true";
    description._translationButton.disabled = true;
    description._translationButton.textContent = summaryLabels.ko.descriptionTranslating;
  });

  try {
    const newDescriptions = pending.filter((description) => (
      !descriptionTranslations.has(getDescriptionTranslationKey(description._repository, description.dataset.sourceText))
    ));
    if (newDescriptions.length) {
      const batch = queueBrowserTranslation(newDescriptions.map((description) => description.dataset.sourceText));
      newDescriptions.forEach((description, index) => {
        const key = getDescriptionTranslationKey(description._repository, description.dataset.sourceText);
        const translation = batch.then((translations) => {
          const translated = translations[index];
          if (detectTextLanguage(translated) !== "ko") {
            throw new Error("저장소 설명이 한국어로 번역되지 않았습니다.");
          }
          return translated;
        });
        descriptionTranslations.set(key, translation);
        translation.catch(() => descriptionTranslations.delete(key));
      });
    }

    const results = await Promise.all(pending.map((description) => {
      const sourceText = description.dataset.sourceText;
      const key = getDescriptionTranslationKey(description._repository, sourceText);
      return descriptionTranslations.get(key);
    }));

    pending.forEach((description, index) => {
      description.dataset.translatedText = results[index];
      description.dataset.translated = "true";
      description.dataset.showingTranslation = "true";
      description.textContent = results[index];
      description._translationButton.disabled = false;
      description._translationButton.textContent = summaryLabels.ko.descriptionOriginal;
      description._translationButton.setAttribute("aria-label", "영어 원문 보기");
    });
  } catch (error) {
    pending.forEach((description) => {
      description._translationButton.disabled = false;
      description._translationButton.textContent = summaryLabels.ko.descriptionRetry;
      description._translationButton.setAttribute("aria-label", "한국어 번역 다시 시도");
      description._translationButton.title = error instanceof Error ? error.message : String(error);
    });
  } finally {
    pending.forEach((description) => {
      delete description.dataset.translating;
    });
  }
}

function renderRepositorySummary(summary, language, notice, sectionsContainer) {
  notice.hidden = !summary.fallback && !summary.translated;
  notice.textContent = summary.translated
    ? summaryLabels[language].translated
    : summary.fallback ? summaryLabels[language].fallback : "";
  sectionsContainer.replaceChildren();
  if (summary.fallback) {
    notice.dataset.sourceLanguage = summary.sourceLanguage;
  }
  for (const section of summary.sections) {
    const article = makeElement("section", "summary-section");
    article.append(makeElement("h4", "", section.label), makeElement("p", "", section.text));
    sectionsContainer.append(article);
  }
}

async function loadRepositorySummary(repository, button, summaryPanel, notice, sectionsContainer, language) {
  const translatorPromise = language === "ko" ? getBrowserTranslator() : null;
  translatorPromise?.catch(() => {});
  button.disabled = true;
  summaryPanel.querySelectorAll(".summary-language-button").forEach((item) => {
    item.disabled = true;
  });
  button.textContent = language === "ko" ? "README 읽는 중…" : "Reading README…";
  notice.hidden = false;
  notice.textContent = summaryLabels[language].loading;
  sectionsContainer.replaceChildren();

  let summary;
  try {
    summary = await fetchReadmeFile(repository, language);
    if (language === "ko") {
      await translatorPromise;
      if (summary.sections.some((section) => (
        detectTextLanguage(section.label) !== "ko" || detectTextLanguage(section.text) !== "ko"
      ))) {
        notice.textContent = summaryLabels.ko.translating;
      }
      summary = await translateSummaryToKorean(summary);
    }
    renderRepositorySummary(summary, language, notice, sectionsContainer);
    summaryPanel.dataset.language = language;
    button.textContent = "핵심 내용 접기 / Collapse −";
    button.setAttribute("aria-expanded", "true");
  } catch (error) {
    notice.hidden = false;
    if (language === "ko" && summary?.sections.some((section) => (
      detectTextLanguage(section.label) !== "ko" || detectTextLanguage(section.text) !== "ko"
    ))) {
      renderRepositorySummary({ ...summary, fallback: true }, language, notice, sectionsContainer);
      notice.textContent = `${summaryLabels.ko.translationError} (${error.message})`;
      const retryButton = makeElement("button", "summary-retry-button", "한국어 번역 다시 시도");
      retryButton.type = "button";
      retryButton.addEventListener("click", () => loadRepositorySummary(repository, button, summaryPanel, notice, sectionsContainer, language));
      notice.append(document.createElement("br"), retryButton);
      button.textContent = "핵심 내용 접기 / Collapse −";
      button.setAttribute("aria-expanded", "true");
    } else {
      notice.textContent = error.message;
      button.textContent = "다시 시도 / Retry ↻";
      button.setAttribute("aria-expanded", "false");
      summaryPanel.hidden = true;
    }
  } finally {
    button.disabled = false;
    summaryPanel.querySelectorAll(".summary-language-button").forEach((item) => {
      item.disabled = false;
    });
  }
}

function showRepositorySummary(repository, button, summaryPanel, notice, sectionsContainer) {
  if (!summaryPanel.hidden) {
    summaryPanel.hidden = true;
    button.setAttribute("aria-expanded", "false");
    button.textContent = "핵심 내용 보기 / Summary +";
    return;
  }

  summaryPanel.hidden = false;
  const language = summaryPanel.dataset.language || "ko";
  loadRepositorySummary(repository, button, summaryPanel, notice, sectionsContainer, language);
}

function createSummaryLanguageButton(language) {
  const label = language === "ko" ? "한국어" : "English";
  const languageButton = makeElement("button", `summary-language-button${language === "ko" ? " is-active" : ""}`, label);
  languageButton.type = "button";
  languageButton.setAttribute("aria-pressed", String(language === "ko"));
  return languageButton;
}

function createRepositoryCard(repository, index) {
  const card = makeElement("article", "repo-card");
  card.style.setProperty("--card-index", String(index % PAGE_SIZE));

  const top = makeElement("div", "repo-card-top");
  const rank = makeElement("span", "repo-rank", `NO. ${String(index + 1).padStart(2, "0")}`);
  const starCount = makeElement("span", "repo-stars");
  starCount.setAttribute("aria-label", `${repository.stargazers_count} stars`);
  starCount.append(makeElement("span", "star-icon", "★"), document.createTextNode(` ${formatStars(repository.stargazers_count)}`));
  top.append(rank, starCount);

  const category = makeElement("span", "repo-type", getRepositoryType(repository));
  const title = makeElement("h3", "repo-name");
  const link = makeElement("a", "", `${repository.owner.login} / ${repository.name}`);
  link.href = repository.html_url;
  link.target = "_blank";
  link.rel = "noreferrer";
  title.append(link);

  const sourceDescription = repository.description || "저장소 설명이 아직 등록되지 않았습니다.";
  const descriptionBlock = makeElement("div", "repo-description-block");
  const description = makeElement("p", "repo-description", sourceDescription);
  const descriptionLanguage = detectTextLanguage(sourceDescription);
  const descriptionButton = descriptionLanguage === "en"
    ? makeElement("button", "repo-description-translate", summaryLabels.ko.descriptionTranslate)
    : null;
  if (descriptionButton) {
    description.dataset.sourceText = sourceDescription;
    descriptionButton.type = "button";
    descriptionButton.setAttribute("aria-label", "한국어 번역");
    descriptionButton.addEventListener("click", () => {
      if (description.dataset.translated === "true") {
        const showingTranslation = description.dataset.showingTranslation === "true";
        description.textContent = showingTranslation ? description.dataset.sourceText : description.dataset.translatedText;
        description.dataset.showingTranslation = String(!showingTranslation);
        descriptionButton.textContent = showingTranslation
          ? summaryLabels.ko.descriptionTranslate
          : summaryLabels.ko.descriptionOriginal;
        descriptionButton.setAttribute(
          "aria-label",
          showingTranslation ? "한국어 번역 보기" : "영어 원문 보기"
        );
        return;
      }
      getBrowserTranslator().catch(() => {});
      translateVisibleDescriptions([description]);
    });
  }
  descriptionBlock.append(description);
  if (descriptionButton) descriptionBlock.append(descriptionButton);
  const coreSummary = makeElement("div", "repo-core-summary");
  const summaryButton = makeElement("button", "repo-summary-toggle", "핵심 내용 보기 / Summary +");
  summaryButton.type = "button";
  summaryButton.setAttribute("aria-expanded", "false");
  const summaryPanel = makeElement("div", "repo-summary-panel");
  summaryPanel.hidden = true;
  summaryPanel.dataset.language = "ko";
  const languageSwitch = makeElement("div", "summary-language-switch");
  languageSwitch.setAttribute("role", "group");
  languageSwitch.setAttribute("aria-label", "요약 언어 / Summary language");
  languageSwitch.append(createSummaryLanguageButton("ko"), createSummaryLanguageButton("en"));
  const summaryNotice = makeElement("p", "summary-language-note");
  summaryNotice.hidden = true;
  summaryNotice.setAttribute("aria-live", "polite");
  const summarySections = makeElement("div", "summary-sections");
  languageSwitch.querySelectorAll(".summary-language-button").forEach((languageButton) => {
    languageButton.addEventListener("click", () => {
      if (languageButton.getAttribute("aria-pressed") === "true" || summaryButton.disabled) return;
      languageSwitch.querySelectorAll(".summary-language-button").forEach((item) => {
        const isActive = item === languageButton;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-pressed", String(isActive));
      });
      loadRepositorySummary(repository, summaryButton, summaryPanel, summaryNotice, summarySections, languageButton.textContent === "한국어" ? "ko" : "en");
    });
  });
  summaryPanel.append(languageSwitch, summaryNotice, summarySections);
  summaryButton.addEventListener("click", () => showRepositorySummary(repository, summaryButton, summaryPanel, summaryNotice, summarySections));
  coreSummary.append(summaryButton, summaryPanel);
  const details = makeElement("div", "repo-details");
  const language = makeElement("span", "repo-language", repository.language || "언어 미지정");
  if (repository.language) {
    const languageDot = makeElement("span", "language-dot");
    languageDot.setAttribute("aria-hidden", "true");
    language.prepend(languageDot);
  }
  const updatedLabel = makeElement("span", "repo-updated", formatUpdatedAt(repository.updated_at));
  details.append(language, updatedLabel);

  const footer = makeElement("div", "repo-card-footer");
  const forks = makeElement("span", "", `⑂ ${formatStars(repository.forks_count)} forks`);
  const openLink = makeElement("a", "repo-open", "저장소 보기 ↗");
  openLink.href = repository.html_url;
  openLink.target = "_blank";
  openLink.rel = "noreferrer";
  footer.append(forks, openLink);

  card.append(top, category, title, descriptionBlock, coreSummary, details, footer);
  return card;
}

function setLoading(isLoading, append = false) {
  grid.setAttribute("aria-busy", String(isLoading));
  loadMoreButton.disabled = isLoading;
  if (isLoading && !append) {
    grid.replaceChildren();
    for (let index = 0; index < 6; index += 1) {
      const skeleton = makeElement("div", "repo-skeleton");
      skeleton.setAttribute("aria-hidden", "true");
      grid.append(skeleton);
    }
    summary.textContent = "공개 저장소를 불러오고 있어요...";
    loadMoreButton.hidden = true;
  }
}

function errorMessage(response, payload) {
  if (response.status === 403 || response.status === 429) {
    return "GitHub API 요청 한도에 도달했어요. 잠시 후 다시 시도해 주세요.";
  }
  if (response.status === 422) {
    return "검색어를 확인해 주세요. GitHub 검색 형식과 맞지 않을 수 있어요.";
  }
  return payload?.message || `저장소를 불러오지 못했어요 (HTTP ${response.status}).`;
}

async function loadRepositories({ append = false } = {}) {
  requestController?.abort();
  const controller = new AbortController();
  requestController = controller;
  const requestedPage = append ? currentPage + 1 : 1;
  setLoading(true, append);
  if (!append) resultsNote.textContent = "별이 많은 저장소부터 보여드립니다.";

  const qualifiers = ["stars:>0", "fork:false", "archived:false"];
  if (activeLanguage) qualifiers.push(`language:${activeLanguage}`);
  const query = [searchTerm.trim(), ...qualifiers].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    q: query,
    sort: "stars",
    order: "desc",
    per_page: String(PAGE_SIZE),
    page: String(requestedPage)
  });

  try {
    const response = await fetch(`${API_URL}?${params}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(errorMessage(response, payload));

    const items = payload.items || [];
    currentPage = requestedPage;
    totalCount = payload.total_count || 0;
    const startIndex = (requestedPage - 1) * PAGE_SIZE;
    const cards = items.map((repository, index) => createRepositoryCard(repository, startIndex + index));

    if (!append) grid.replaceChildren(...cards);
    else grid.append(...cards);

    const shownCount = grid.querySelectorAll(".repo-card").length;
    summary.textContent = totalCount
      ? `${numberFormat.format(totalCount)}개 이상의 저장소 · ${shownCount}개 표시 중`
      : "검색 결과가 없습니다.";
    updated.textContent = `조회 ${new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`;
    resultsNote.textContent = "GitHub 공개 저장소를 별 개수 순으로 정렬했습니다.";
    loadMoreButton.hidden = shownCount >= totalCount || items.length < PAGE_SIZE || requestedPage >= 10;
    if (requestedPage >= 10 && shownCount < totalCount) {
      resultsNote.textContent = "GitHub 검색 API는 한 검색에서 최대 1,000개의 결과를 제공합니다.";
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    if (!append) {
      grid.replaceChildren();
      const errorCard = makeElement("div", "error-card");
      errorCard.append(
        makeElement("span", "error-icon", "!"),
        makeElement("h3", "", "저장소를 불러오지 못했어요"),
        makeElement("p", "", error.message),
        makeElement("button", "retry-button", "다시 시도")
      );
      errorCard.querySelector("button").addEventListener("click", () => loadRepositories());
      grid.append(errorCard);
      summary.textContent = "GitHub 연결을 확인해 주세요.";
      resultsNote.textContent = "네트워크 상태를 확인한 뒤 다시 시도할 수 있어요.";
    } else {
      resultsNote.textContent = error.message;
    }
    loadMoreButton.hidden = true;
  } finally {
    if (!controller.signal.aborted) setLoading(false, true);
  }
}

async function loadSavingsRepositories({ append = false } = {}) {
  savingsRequestController?.abort();
  const controller = new AbortController();
  savingsRequestController = controller;
  const requestedPage = append ? savingsPage + 1 : 1;
  const activeCategory = savingsCategories.querySelector(".is-active");
  savingsNote.textContent = activeCategory?.dataset.description || "";
  savingsGrid.setAttribute("aria-busy", "true");
  savingsLoadMoreButton.disabled = true;

  if (!append) {
    savingsGrid.replaceChildren();
    for (let index = 0; index < 3; index += 1) {
      const skeleton = makeElement("div", "repo-skeleton");
      skeleton.setAttribute("aria-hidden", "true");
      savingsGrid.append(skeleton);
    }
    savingsSummary.textContent = "저장소를 불러오고 있어요...";
    savingsLoadMoreButton.hidden = true;
  }

  const query = [activeSavingsQuery, "stars:>0", "fork:false", "archived:false"].join(" ");
  const params = new URLSearchParams({
    q: query,
    sort: "stars",
    order: "desc",
    per_page: "12",
    page: String(requestedPage)
  });

  try {
    const response = await fetch(`${API_URL}?${params}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(errorMessage(response, payload));

    const items = payload.items || [];
    savingsPage = requestedPage;
    savingsTotalCount = payload.total_count || 0;
    const startIndex = (requestedPage - 1) * 12;
    const cards = items.map((repository, index) => {
      const card = createRepositoryCard(repository, startIndex + index);
      card.classList.add("savings-card");
      return card;
    });

    if (append) savingsGrid.append(...cards);
    else savingsGrid.replaceChildren(...cards);

    const shownCount = savingsGrid.querySelectorAll(".repo-card").length;
    savingsSummary.textContent = savingsTotalCount
      ? `${numberFormat.format(savingsTotalCount)}개 이상의 검색 결과 · ${shownCount}개 표시 중`
      : "검색 결과가 없습니다. 다른 분류를 선택해 보세요.";
    savingsLoadMoreButton.hidden = items.length < 12 || shownCount >= savingsTotalCount || requestedPage >= 10;
    if (requestedPage >= 10 && shownCount < savingsTotalCount) {
      savingsSummary.textContent += " · GitHub 검색 API는 검색당 최대 1,000개까지 제공합니다.";
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    if (!append) {
      const errorCard = makeElement("div", "error-card");
      errorCard.append(
        makeElement("span", "error-icon", "!"),
        makeElement("h3", "", "비용 절감 저장소를 불러오지 못했어요"),
        makeElement("p", "", error.message),
        makeElement("button", "retry-button", "다시 시도")
      );
      errorCard.querySelector("button").addEventListener("click", () => loadSavingsRepositories());
      savingsGrid.replaceChildren(errorCard);
      savingsSummary.textContent = "GitHub 연결을 확인해 주세요.";
    } else {
      savingsSummary.textContent = error.message;
    }
    savingsLoadMoreButton.hidden = true;
  } finally {
    if (!controller.signal.aborted) {
      savingsGrid.setAttribute("aria-busy", "false");
      savingsLoadMoreButton.disabled = false;
    }
  }
}

async function loadMediaRepositories({ append = false } = {}) {
  mediaRequestController?.abort();
  const controller = new AbortController();
  mediaRequestController = controller;
  const requestedPage = append ? mediaPage + 1 : 1;
  mediaNote.textContent = activeMediaDescription;
  mediaGrid.setAttribute("aria-busy", "true");
  mediaLoadMoreButton.disabled = true;

  if (!append) {
    mediaGrid.replaceChildren();
    for (let index = 0; index < 3; index += 1) {
      const skeleton = makeElement("div", "repo-skeleton");
      skeleton.setAttribute("aria-hidden", "true");
      mediaGrid.append(skeleton);
    }
    mediaSummary.textContent = "저장소를 불러오고 있어요...";
    mediaLoadMoreButton.hidden = true;
  }

  const query = [activeMediaQuery, "stars:>0", "fork:false", "archived:false"].join(" ");
  const params = new URLSearchParams({
    q: query,
    sort: "stars",
    order: "desc",
    per_page: "12",
    page: String(requestedPage)
  });

  try {
    const response = await fetch(`${API_URL}?${params}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(errorMessage(response, payload));

    const items = payload.items || [];
    mediaPage = requestedPage;
    mediaTotalCount = payload.total_count || 0;
    const startIndex = (requestedPage - 1) * 12;
    const cards = items.map((repository, index) => {
      const card = createRepositoryCard(repository, startIndex + index);
      card.classList.add("media-card");
      return card;
    });

    if (append) mediaGrid.append(...cards);
    else mediaGrid.replaceChildren(...cards);

    const shownCount = mediaGrid.querySelectorAll(".repo-card").length;
    mediaSummary.textContent = mediaTotalCount
      ? `${numberFormat.format(mediaTotalCount)}개 이상의 검색 결과 · ${shownCount}개 표시 중`
      : "검색 결과가 없습니다. 다른 분류를 선택해 보세요.";
    mediaLoadMoreButton.hidden = items.length < 12 || shownCount >= mediaTotalCount || requestedPage >= 10;
    if (requestedPage >= 10 && shownCount < mediaTotalCount) {
      mediaSummary.textContent += " · GitHub 검색 API는 검색당 최대 1,000개까지 제공합니다.";
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    if (!append) {
      const errorCard = makeElement("div", "error-card");
      errorCard.append(
        makeElement("span", "error-icon", "!"),
        makeElement("h3", "", "생성형 미디어 저장소를 불러오지 못했어요"),
        makeElement("p", "", error.message),
        makeElement("button", "retry-button", "다시 시도")
      );
      errorCard.querySelector("button").addEventListener("click", () => loadMediaRepositories());
      mediaGrid.replaceChildren(errorCard);
      mediaSummary.textContent = "GitHub 연결을 확인해 주세요.";
    } else {
      mediaSummary.textContent = error.message;
    }
    mediaLoadMoreButton.hidden = true;
  } finally {
    if (!controller.signal.aborted) {
      mediaGrid.setAttribute("aria-busy", "false");
      mediaLoadMoreButton.disabled = false;
    }
  }
}

function populateCategorySelect(select, items) {
  select.replaceChildren(...items.map((item, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = item.name;
    return option;
  }));
}

function updateMediaCategoryOptions({ search = true, changedLevel = "major" } = {}) {
  const major = mediaCategoryTree[Number(mediaMajorCategory.value)];
  if (!major) return;
  if (changedLevel === "major") {
    populateCategorySelect(mediaMiddleCategory, major.categories);
  }

  const middle = major.categories[Number(mediaMiddleCategory.value)];
  if (!middle) return;
  if (changedLevel !== "small") {
    populateCategorySelect(mediaSmallCategory, middle.items);
  }

  const small = middle.items[Number(mediaSmallCategory.value)];
  if (!small) return;
  activeMediaQuery = small.query;
  activeMediaDescription = small.description;
  mediaMenuCurrent.textContent = `${major.name} / ${middle.name} / ${small.name}`;
  mediaNote.textContent = small.description;
  if (search) loadMediaRepositories();
  if (changedLevel === "small") {
    mediaCategoryPanel.hidden = true;
    mediaMenuToggle.setAttribute("aria-expanded", "false");
  }
}

function initializeMediaCategories() {
  populateCategorySelect(mediaMajorCategory, mediaCategoryTree);
  updateMediaCategoryOptions({ search: false, changedLevel: "major" });
  mediaCategoryPanel.hidden = true;
  mediaMenuToggle.addEventListener("click", () => {
    const isExpanded = mediaMenuToggle.getAttribute("aria-expanded") === "true";
    mediaMenuToggle.setAttribute("aria-expanded", String(!isExpanded));
    mediaCategoryPanel.hidden = isExpanded;
  });
  mediaMajorCategory.addEventListener("change", () => updateMediaCategoryOptions({ changedLevel: "major" }));
  mediaMiddleCategory.addEventListener("change", () => updateMediaCategoryOptions({ changedLevel: "middle" }));
  mediaSmallCategory.addEventListener("change", () => updateMediaCategoryOptions({ changedLevel: "small" }));
  document.addEventListener("click", (event) => {
    if (mediaCategoryPanel.hidden || event.target.closest(".media-category-menu")) return;
    mediaCategoryPanel.hidden = true;
    mediaMenuToggle.setAttribute("aria-expanded", "false");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || mediaCategoryPanel.hidden) return;
    mediaCategoryPanel.hidden = true;
    mediaMenuToggle.setAttribute("aria-expanded", "false");
    mediaMenuToggle.focus();
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  searchTerm = searchInput.value;
  loadRepositories();
});

filters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-language]");
  if (!button) return;
  activeLanguage = button.dataset.language;
  const activeButton = filters.querySelector(".is-active");
  activeButton?.classList.remove("is-active");
  activeButton?.setAttribute("aria-pressed", "false");
  button.classList.add("is-active");
  button.setAttribute("aria-pressed", "true");
  loadRepositories();
});

loadMoreButton.addEventListener("click", () => loadRepositories({ append: true }));
savingsCategories.addEventListener("click", (event) => {
  const button = event.target.closest("[data-query]");
  if (!button) return;
  const activeButton = savingsCategories.querySelector(".is-active");
  activeButton?.classList.remove("is-active");
  activeButton?.setAttribute("aria-pressed", "false");
  button.classList.add("is-active");
  button.setAttribute("aria-pressed", "true");
  activeSavingsQuery = button.dataset.query;
  loadSavingsRepositories();
});
savingsLoadMoreButton.addEventListener("click", () => loadSavingsRepositories({ append: true }));
mediaLoadMoreButton.addEventListener("click", () => loadMediaRepositories({ append: true }));

loadRepositories();
loadSavingsRepositories();
initializeMediaCategories();
loadMediaRepositories();
