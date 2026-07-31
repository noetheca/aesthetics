const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/u;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textContent(node) {
  if (!node || typeof node !== "object") return "";
  if (typeof node.value === "string") return node.value;
  if (!Array.isArray(node.children)) return "";
  return node.children.map(textContent).join("");
}

function parseTime(value) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (/^\d+$/u.test(normalized)) return Number(normalized);

  const units = normalized.match(
    /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/u,
  );
  if (units && units[0]) {
    const hours = Number(units[1] ?? 0);
    const minutes = Number(units[2] ?? 0);
    const seconds = Number(units[3] ?? 0);
    return hours * 3600 + minutes * 60 + seconds;
  }

  const colonParts = normalized.split(":");
  if (
    colonParts.length >= 2 &&
    colonParts.length <= 3 &&
    colonParts.every((part) => /^\d+$/u.test(part))
  ) {
    return colonParts.reduce(
      (total, part) => total * 60 + Number(part),
      0,
    );
  }
  return undefined;
}

function startSeconds(url) {
  const fragment = new URLSearchParams(url.hash.replace(/^#/u, ""));
  const candidates = [
    url.searchParams.get("start"),
    url.searchParams.get("t"),
    fragment.get("start"),
    fragment.get("t"),
  ];
  for (const candidate of candidates) {
    const seconds = parseTime(candidate);
    if (Number.isSafeInteger(seconds) && seconds >= 0) return seconds;
  }
  return undefined;
}

export function parseYouTubeVideoUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return undefined;
  }

  const hostname = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  let videoId;
  if (hostname === "youtu.be") {
    if (segments.length === 1) videoId = segments[0];
  } else if (YOUTUBE_HOSTS.has(hostname)) {
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v") ?? undefined;
    } else if (
      segments.length === 2 &&
      (segments[0] === "shorts" || segments[0] === "live")
    ) {
      videoId = segments[1];
    }
  }
  if (!videoId || !VIDEO_ID.test(videoId)) return undefined;

  return {
    videoId,
    start: startSeconds(url),
    sourceUrl: url.href,
  };
}

export function renderYouTubeEmbed(link) {
  if (
    !link ||
    link.type !== "link" ||
    typeof link.url !== "string"
  ) {
    return undefined;
  }
  const video = parseYouTubeVideoUrl(link.url);
  if (!video) return undefined;

  const label = textContent(link).trim() || video.sourceUrl;
  const query = video.start === undefined ? "" : `?start=${video.start}`;
  const embedUrl =
    `https://www.youtube-nocookie.com/embed/${video.videoId}${query}`;
  const escapedSource = escapeHtml(video.sourceUrl);
  const escapedLabel = escapeHtml(label);
  const escapedTitle = escapeHtml(`YouTube video: ${label}`);

  return [
    '<figure class="aesthetics-youtube">',
    '  <div class="aesthetics-youtube__frame">',
    `    <iframe src="${embedUrl}" title="${escapedTitle}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
    "  </div>",
    `  <figcaption><a href="${escapedSource}">${escapedLabel}</a></figcaption>`,
    "</figure>",
  ].join("\n");
}

function transformNode(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node.children)) {
    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      if (
        child?.type === "paragraph" &&
        Array.isArray(child.children)
      ) {
        const embeds = [];
        let mediaOnly = true;
        for (const paragraphChild of child.children) {
          if (
            paragraphChild?.type === "break" ||
            (paragraphChild?.type === "text" &&
              /^\s*$/u.test(paragraphChild.value ?? ""))
          ) {
            continue;
          }
          const html = renderYouTubeEmbed(paragraphChild);
          if (!html) {
            mediaOnly = false;
            break;
          }
          embeds.push(html);
        }
        if (mediaOnly && embeds.length > 0) {
          node.children[index] = {
            type: "html",
            value: embeds.join("\n"),
          };
          continue;
        }
      }
      transformNode(child);
    }
  }
}

export default function youtubeEmbeds() {
  return transformNode;
}
