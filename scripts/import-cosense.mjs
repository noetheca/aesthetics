import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const API_ORIGIN = "https://scrapbox.io";
const DEFAULT_PROJECT = "AestheticsWiki";
const REQUEST_DELAY_MS = 150;
const MAX_ATTEMPTS = 4;
const PROJECT_META_TITLES = new Set([
  "settings",
  "このProject（美学ウィキ）について。",
  "ディスカッション",
  "テンプレート",
  "メモ",
]);

const RELATION_OVERRIDES = new Map([
  [
    "6977ad0e5f88b7abe4a99125:6977e691e21794c7cae4c3ba",
    {
      relationType: "influenced-by",
      direction: "directed",
      reviewStatus: "needs-evidence",
      confidence: "low",
      basis: "explicit-source-wording",
      rationale:
        "元ページ本文はFrutiger Aeroからの影響を明記しているが、独立した出典確認は未完了。",
    },
  ],
  [
    "6977f104df1b80cff76f6bf6:69998a0b58b8fa96506687d3",
    {
      relationType: "influenced-by",
      direction: "directed",
      reviewStatus: "needs-evidence",
      confidence: "low",
      basis: "explicit-source-wording",
      rationale:
        "元ページ本文はOld Webを明確な参照元と述べるが、独立した出典確認は未完了。",
    },
  ],
]);

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function normalizeTitle(title) {
  return title
    .normalize("NFKC")
    .replaceAll("_", " ")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

export function compareUnicodeCodePoints(left, right) {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0));
  const rightPoints = Array.from(right, (character) => character.codePointAt(0));
  const sharedLength = Math.min(leftPoints.length, rightPoints.length);

  for (let index = 0; index < sharedLength; index += 1) {
    const difference = leftPoints[index] - rightPoints[index];
    if (difference !== 0) {
      return difference;
    }
  }

  return leftPoints.length - rightPoints.length;
}

export function sourcePageUrl(project, title) {
  return `${API_ORIGIN}/${encodeURIComponent(project)}/${encodeURIComponent(title)}`;
}

export function buildConceptId(pageId) {
  if (!/^[a-f0-9]{24}$/u.test(pageId)) {
    throw new Error(`Unexpected Cosense page ID: "${pageId}".`);
  }
  return `aesthetics/scrapbox/${pageId}`;
}

export function classifyPage(page) {
  if (PROJECT_META_TITLES.has(page.title)) {
    return "project-meta";
  }
  if (page.lines.some((line) => line.trim() === "#member")) {
    return "profile";
  }
  if (page.title.startsWith("未定：") || page.charsCount < 200) {
    return "stub";
  }
  return "content";
}

function markdownLabel(value) {
  return value.replaceAll("[", "\\[").replaceAll("]", "\\]");
}

function crossProjectUrl(target) {
  const [project, ...titleParts] = target.replace(/^\//u, "").split("/");
  if (!project) {
    return API_ORIGIN;
  }
  const projectRoot = `${API_ORIGIN}/${encodeURIComponent(project)}`;
  const title = titleParts.join("/");
  return title ? `${projectRoot}/${encodeURIComponent(title)}` : projectRoot;
}

function convertBracket(project, inside) {
  const value = inside.trim();
  const urlMatch = value.match(/https?:\/\/\S+/u);
  if (urlMatch) {
    const url = urlMatch[0];
    const label = value.replace(url, "").trim() || url;
    return `[${markdownLabel(label)}](${url})`;
  }
  if (value.startsWith("/")) {
    return `[${markdownLabel(value)}](${crossProjectUrl(value)})`;
  }
  if (/^\*+\s*\S/u.test(value)) {
    const text = value.replace(/^\*+\s*/u, "");
    return `**${text}**`;
  }
  return `[${markdownLabel(value)}](${sourcePageUrl(project, value)})`;
}

export function convertScrapboxLine(line, project = DEFAULT_PROJECT) {
  const heading = line.match(/^\[(\*{1,6})\s+(.+)\]$/u);
  if (heading) {
    const level = Math.max(2, Math.min(6, heading[1].length));
    return `${"#".repeat(level)} ${heading[2].trim()}`;
  }

  const indentation = line.match(/^[\t ]+/u)?.[0].length ?? 0;
  let converted = line.trim();
  converted = converted.replace(/<\/?[A-Za-z][^>]*>/gu, (tag) =>
    tag.replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
  );
  converted = converted.replace(/\[([^\[\]]+)\]/gu, (_match, inside) =>
    convertBracket(project, inside),
  );

  if (indentation > 0 && converted) {
    return `- ${converted}`;
  }
  return converted;
}

function cleanSummaryLine(line, page) {
  return convertScrapboxLine(line, page.project)
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replace(/https?:\/\/\S+/gu, "")
    .replace(/[*_`>#]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function pageSummary(page) {
  const descriptionStart = page.lines.findIndex((line) =>
    /^\[\*{1,6}\s+説明\]$/u.test(line.trim()),
  );
  const descriptionTail =
    descriptionStart >= 0 ? page.lines.slice(descriptionStart + 1) : [];
  const nextHeading = descriptionTail.findIndex((line) =>
    /^\[\*{1,6}\s+/u.test(line.trim()),
  );
  const descriptionLines =
    nextHeading >= 0 ? descriptionTail.slice(0, nextHeading) : descriptionTail;
  const candidate = [...descriptionLines, ...page.descriptions, ...page.lines]
    .filter(
      (line) =>
        !/^\[\*{1,6}\s+/u.test(line.trim()) &&
        !/^https?:\/\//u.test(line.trim()) &&
        !/^\[https?:\/\//u.test(line.trim()),
    )
    .map((line) => cleanSummaryLine(line, page))
    .find(
      (line) =>
        line.length >= 20 &&
        line !== "Aesthetics Wikiにある" &&
        !line.startsWith("! メモ："),
    );
  if (candidate) {
    return candidate.slice(0, 180);
  }
  const period = page.descriptions
    .map((line) => cleanSummaryLine(line, page))
    .find((line) => line.startsWith("時期："));
  if (period) {
    return `${page.title}。${period}`.slice(0, 180);
  }
  return `美学ウィキから許諾に基づいて移植した「${page.title}」のページ。`;
}

function retryDelay(response, attempt) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) {
      return Math.max(0, seconds * 1_000);
    }
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) {
      return Math.max(0, date - Date.now());
    }
  }
  return 500 * 2 ** attempt;
}

async function fetchJson(url) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent":
          "noetheca-aesthetics-importer/0.1 (+https://github.com/noetheca/aesthetics)",
      },
    });
    if (response.ok) {
      return response.json();
    }
    const retryable =
      response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS - 1) {
      throw new Error(`Cosense request failed (${response.status}): ${url}`);
    }
    await delay(retryDelay(response, attempt));
  }
  throw new Error(`Cosense request exhausted retries: ${url}`);
}

async function fetchPageList(project) {
  const pages = [];
  let skip = 0;
  let count = Number.POSITIVE_INFINITY;
  while (skip < count) {
    const url =
      `${API_ORIGIN}/api/pages/${encodeURIComponent(project)}` +
      `?skip=${skip}&limit=100`;
    const response = await fetchJson(url);
    count = response.count;
    pages.push(...response.pages);
    skip = pages.length;
  }
  return pages;
}

function listSignature(pages) {
  return pages
    .map(({ id, title, updated }) => ({ id, title, updated }))
    .sort((left, right) => compareUnicodeCodePoints(left.id, right.id));
}

function normalizedPage(project, summary, detail) {
  const lines = detail.lines.map(({ text }) => text);
  const descriptions = Array.isArray(summary.descriptions)
    ? summary.descriptions
    : [];
  const links = Array.isArray(detail.links) ? detail.links : [];
  return {
    project,
    id: detail.id,
    title: detail.title,
    created: detail.created,
    updated: detail.updated,
    charsCount: summary.charsCount ?? lines.join("\n").length,
    descriptions,
    lines,
    links,
    textSha256: sha256(`${lines.join("\n")}\n`),
    sourceUrl: sourcePageUrl(project, detail.title),
  };
}

export async function fetchSnapshot(project = DEFAULT_PROJECT) {
  const before = await fetchPageList(project);
  const pages = [];

  for (const [index, summary] of before.entries()) {
    const url =
      `${API_ORIGIN}/api/pages/${encodeURIComponent(project)}/` +
      encodeURIComponent(summary.title);
    const detail = await fetchJson(url);
    pages.push(normalizedPage(project, summary, detail));
    if (index < before.length - 1) {
      await delay(REQUEST_DELAY_MS);
    }
  }

  const after = await fetchPageList(project);
  if (
    JSON.stringify(listSignature(before)) !==
    JSON.stringify(listSignature(after))
  ) {
    throw new Error(
      "AestheticsWiki changed while the snapshot was being read. Run the importer again.",
    );
  }

  const fetchedAt = new Date().toISOString();
  return {
    schemaVersion: 1,
    source: {
      service: "Cosense/Scrapbox",
      project,
      projectUrl: `${API_ORIGIN}/${encodeURIComponent(project)}/`,
      apiStability: "internal-api-may-change-without-notice",
    },
    fetchedAt,
    pageCount: pages.length,
    pages: pages.sort((left, right) =>
      compareUnicodeCodePoints(left.id, right.id),
    ),
  };
}

function titleIndex(pages) {
  const index = new Map();
  for (const page of pages) {
    const key = normalizeTitle(page.title);
    const matches = index.get(key) ?? [];
    matches.push(page);
    index.set(key, matches);
  }
  return index;
}

function isConceptClassification(classification) {
  return classification === "content" || classification === "stub";
}

function linkEvidence(page, linkTitle) {
  const normalizedLink = normalizeTitle(linkTitle);
  const lineIndex = page.lines.findIndex((line) => {
    const normalizedTag = line.trim().startsWith("#")
      ? normalizeTitle(line.trim().slice(1))
      : undefined;
    return (
      normalizedTag === normalizedLink ||
      [...line.matchAll(/\[([^\[\]]+)\]/gu)].some((match) => {
        const value = match[1].trim();
        return (
          !value.startsWith("/") &&
          !/^\*+\s/u.test(value) &&
          !/https?:\/\//u.test(value) &&
          normalizeTitle(value) === normalizedLink
        );
      })
    );
  });
  return {
    kind: "source-snapshot-line",
    locale: "ja",
    sourcePageId: page.id,
    sourcePageTitle: page.title,
    sourceUrl: page.sourceUrl,
    sourceUpdated: page.updated,
    sourceTextSha256: page.textSha256,
    lineNumber: lineIndex >= 0 ? lineIndex + 1 : null,
    lineText: lineIndex >= 0 ? page.lines[lineIndex] : null,
    linkTitle,
  };
}

export function buildRelationAudit(snapshot) {
  const classifications = new Map(
    snapshot.pages.map((page) => [page.id, classifyPage(page)]),
  );
  const byTitle = titleIndex(snapshot.pages);
  const candidates = new Map();
  const skippedLinks = [];
  let eligibleLinkReferences = 0;

  for (const page of snapshot.pages) {
    const sourceClassification = classifications.get(page.id);
    for (const linkTitle of page.links) {
      const evidence = linkEvidence(page, linkTitle);
      const matches = byTitle.get(normalizeTitle(linkTitle)) ?? [];
      let resolution;
      let target;

      if (!isConceptClassification(sourceClassification)) {
        resolution = "source-not-concept";
      } else if (matches.length === 0) {
        resolution = "target-not-in-snapshot";
      } else if (matches.length > 1) {
        resolution = "ambiguous-target-title";
      } else {
        [target] = matches;
        const targetClassification = classifications.get(target.id);
        if (!isConceptClassification(targetClassification)) {
          resolution = "target-not-concept";
        } else if (target.id === page.id) {
          resolution = "self-link";
        }
      }

      if (resolution || !target) {
        skippedLinks.push({
          sourcePageId: page.id,
          sourcePageTitle: page.title,
          sourceUrl: page.sourceUrl,
          linkTitle,
          resolution: resolution ?? "unresolved",
          evidence,
        });
        continue;
      }

      eligibleLinkReferences += 1;
      const key = `${page.id}:${target.id}`;
      const override = RELATION_OVERRIDES.get(key);
      const existing = candidates.get(key);
      if (existing) {
        existing.evidence.push(evidence);
        continue;
      }
      candidates.set(key, {
        id: `cosense-link:${page.id}:${target.id}`,
        sourceConceptId: buildConceptId(page.id),
        targetConceptId: buildConceptId(target.id),
        relationType: override?.relationType ?? "associated-with",
        direction: override?.direction ?? "undirected",
        reviewStatus: override?.reviewStatus ?? "unreviewed",
        confidence: override?.confidence ?? "unassessed",
        basis: override?.basis ?? "same-project-link",
        rationale:
          override?.rationale ??
          "同一Project内リンクは閲覧上の近接性だけを示し、因果・継承・同時代性を主張しない。",
        evidence: [evidence],
      });
    }
  }

  const sortedCandidates = [...candidates.values()].sort((left, right) =>
    compareUnicodeCodePoints(left.id, right.id),
  );
  skippedLinks.sort((left, right) =>
    compareUnicodeCodePoints(
      `${left.sourcePageId}:${left.linkTitle}`,
      `${right.sourcePageId}:${right.linkTitle}`,
    ),
  );

  return {
    schemaVersion: 1,
    taxonomyVersion: 1,
    generatedFrom: {
      snapshot: `source/cosense/${snapshot.source.project}.json`,
      sourceProject: snapshot.source.project,
      sourceProjectUrl: snapshot.source.projectUrl,
      fetchedAt: snapshot.fetchedAt,
      license: "CC-BY-SA-4.0",
      attribution: "AestheticsWiki contributors",
      modifications:
        "Resolved internal link targets and recorded review-only relation candidates with source-line evidence.",
    },
    policy: {
      defaultRelationType: "associated-with",
      defaultReviewStatus: "unreviewed",
      publicGraphPromotion: "human-review-required",
      documentation: "docs/relationship-model.md",
    },
    counts: {
      sourceLinkReferences: snapshot.pages.reduce(
        (count, page) => count + page.links.length,
        0,
      ),
      eligibleLinkReferences,
      candidateRelations: sortedCandidates.length,
      explicitWordingCandidates: sortedCandidates.filter(
        ({ basis }) => basis === "explicit-source-wording",
      ).length,
      skippedLinks: skippedLinks.length,
    },
    candidates: sortedCandidates,
    skippedLinks,
  };
}

function importNotice(page) {
  return [
    "> [美学ウィキ](" +
      page.sourceUrl +
      ")（作成・運営: hazuqu、AestheticsWiki contributors）から、",
    "> 直接許諾に基づいて移植し、Scrapbox記法をMarkdownへ変換しました。",
    "> この翻案は[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)です。",
    "> 外部画像・動画・リンク先の権利は各権利者に帰属し、このライセンスには含まれません。",
  ].join("\n");
}

function pageBody(page) {
  const sourceLines =
    normalizeTitle(page.lines[0] ?? "") === normalizeTitle(page.title)
      ? page.lines.slice(1)
      : page.lines;
  const converted = sourceLines
    .map((line) => convertScrapboxLine(line, page.project))
    .join("\n")
    .trim();
  return `${importNotice(page)}\n\n${
    converted || "_元ページには本文がありません。_"
  }\n`;
}

function frontmatter(page, status) {
  return {
    locale: "ja",
    title: page.title,
    summary: pageSummary(page),
    sources: [
      {
        title: `美学ウィキ: ${page.title}`,
        url: page.sourceUrl,
        note: "2026-07-31 import snapshot; converted from Scrapbox notation",
      },
    ],
    status,
  };
}

async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

export async function renderSnapshot(snapshot, root = process.cwd()) {
  const classifications = new Map(
    snapshot.pages.map((page) => [page.id, classifyPage(page)]),
  );
  const pageMap = [];

  for (const page of snapshot.pages) {
    const classification = classifications.get(page.id);
    if (classification === "content" || classification === "stub") {
      const directory = `concepts/imported/${page.id.slice(0, 2)}/${page.id}`;
      const metadata = {
        schemaVersion: 1,
        id: buildConceptId(page.id),
        prerequisites: [],
        related: [],
      };
      const status = classification === "stub" ? "draft" : "review";
      await writeJson(resolve(root, directory, "concept.yaml"), metadata);
      await writeText(
        resolve(root, directory, "ja.md"),
        `---\n${JSON.stringify(frontmatter(page, status), null, 2)}\n---\n\n${pageBody(page)}`,
      );
      pageMap.push({
        sourcePageId: page.id,
        title: page.title,
        classification,
        status,
        conceptId: metadata.id,
        outputPath: `${directory}/ja.md`,
        sourceUrl: page.sourceUrl,
      });
      continue;
    }

    const outputPath = `archive/cosense/${page.id}.md`;
    await writeText(
      resolve(root, outputPath),
      `---\n${JSON.stringify(
        {
          title: page.title,
          sourceUrl: page.sourceUrl,
          sourcePageId: page.id,
          classification,
          status: "archive",
        },
        null,
        2,
      )}\n---\n\n${pageBody(page)}`,
    );
    pageMap.push({
      sourcePageId: page.id,
      title: page.title,
      classification,
      status: "archive",
      outputPath,
      sourceUrl: page.sourceUrl,
    });
  }

  await writeJson(
    resolve(root, "source/cosense/page-map.json"),
    {
      schemaVersion: 1,
      sourceProject: snapshot.source.project,
      fetchedAt: snapshot.fetchedAt,
      counts: Object.fromEntries(
        ["content", "stub", "project-meta", "profile"].map((classification) => [
          classification,
          pageMap.filter((page) => page.classification === classification)
            .length,
        ]),
      ),
      pages: pageMap.sort((left, right) =>
        compareUnicodeCodePoints(left.sourcePageId, right.sourcePageId),
      ),
    },
  );
  await writeJson(
    resolve(root, "relations/cosense-link-audit.json"),
    buildRelationAudit(snapshot),
  );
  return pageMap;
}

function parseArguments(argumentsList) {
  const options = { project: DEFAULT_PROJECT, snapshot: undefined };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--project") {
      options.project = argumentsList[index + 1];
      index += 1;
    } else if (argument === "--snapshot") {
      options.snapshot = argumentsList[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const root = process.cwd();
  const snapshot = options.snapshot
    ? JSON.parse(await readFile(resolve(root, options.snapshot), "utf8"))
    : await fetchSnapshot(options.project);
  const snapshotPath = resolve(
    root,
    "source/cosense",
    `${snapshot.source.project}.json`,
  );
  if (!options.snapshot) {
    await writeJson(snapshotPath, snapshot);
  }
  const pageMap = await renderSnapshot(snapshot, root);
  const counts = pageMap.reduce((result, page) => {
    result[page.classification] = (result[page.classification] ?? 0) + 1;
    return result;
  }, {});
  process.stdout.write(
    `Imported ${pageMap.length} page(s) from ${snapshot.source.project}: ` +
      `${JSON.stringify(counts)}\n`,
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined;
if (invokedPath === import.meta.url) {
  await main();
}
