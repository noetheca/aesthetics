const MISSING_PERIOD = "記載なし";
const PERIOD_LINE = /^[\t ]*時期[：:][\t ]*(.*?)[\t ]*$/mu;
const EXPLICIT_YEAR = /(?<!\d)(?:1\d{3}|2\d{3}|3\d{3})(?!\d)/gu;
const HTTPS_URL = /https:\/\/[^\s<>()\[\]{}"']+/giu;
const IMAGE_PATH = /\.(?:avif|gif|jpe?g|png|svg|webp)$/iu;
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/u;

export interface AestheticsContext {
  periodRaw: string;
  chronology?: number;
  thumbnail?: string;
}

export function extractPeriodRaw(markdown: string): string {
  const value = PERIOD_LINE.exec(markdown)?.[1]?.trim();
  return value || MISSING_PERIOD;
}

export function extractChronologyAnchor(markdown: string): number | undefined {
  const periodRaw = extractPeriodRaw(markdown);
  if (periodRaw === MISSING_PERIOD) {
    return undefined;
  }

  const years = [...periodRaw.matchAll(EXPLICIT_YEAR)].map((match) =>
    Number(match[0]),
  );
  return years.length > 0 ? Math.min(...years) : undefined;
}

function extractHttpsUrls(markdown: string): string[] {
  return [...markdown.matchAll(HTTPS_URL)].map((match) =>
    match[0].replace(/[.,;!?\u3001\u3002]+$/u, ""),
  );
}

function parseHttpsUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function explicitImageUrl(value: string): string | undefined {
  const url = parseHttpsUrl(value);
  if (!url || !IMAGE_PATH.test(url.pathname)) {
    return undefined;
  }
  return url.href;
}

function youtubeVideoId(value: string): string | undefined {
  const url = parseHttpsUrl(value);
  if (!url) {
    return undefined;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./u, "");
  const segments = url.pathname.split("/").filter(Boolean);
  let candidate: string | null | undefined;

  if (host === "youtu.be") {
    candidate = segments[0];
  } else if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com"
  ) {
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v");
    } else if (["embed", "live", "shorts"].includes(segments[0] ?? "")) {
      candidate = segments[1];
    }
  } else if (host === "youtube-nocookie.com" && segments[0] === "embed") {
    candidate = segments[1];
  }

  return candidate && YOUTUBE_VIDEO_ID.test(candidate) ? candidate : undefined;
}

export function extractGraphThumbnail(markdown: string): string | undefined {
  const urls = extractHttpsUrls(markdown);
  for (const value of urls) {
    const image = explicitImageUrl(value);
    if (image) {
      return image;
    }
  }

  for (const value of urls) {
    const videoId = youtubeVideoId(value);
    if (videoId) {
      return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }
  }
  return undefined;
}

export function extractAestheticsContext(markdown: string): AestheticsContext {
  const periodRaw = extractPeriodRaw(markdown);
  const chronology = extractChronologyAnchor(markdown);
  const thumbnail = extractGraphThumbnail(markdown);

  return {
    periodRaw,
    ...(chronology === undefined ? {} : { chronology }),
    ...(thumbnail === undefined ? {} : { thumbnail }),
  };
}
