import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import {
  buildRelationAudit,
  buildConceptId,
  classifyPage,
  convertScrapboxLine,
  normalizeTitle,
  sourcePageUrl,
} from "../scripts/import-cosense.mjs";

test("normalizes titles without using them as IDs", () => {
  assert.equal(normalizeTitle("Liminal_space"), "liminal space");
  assert.equal(
    buildConceptId("6977addd521bdf0ca3c5a23f"),
    "aesthetics/scrapbox/6977addd521bdf0ca3c5a23f",
  );
  assert.throws(() => buildConceptId("Liminal space"));
});

test("classifies operational, profile, stub, and content pages", () => {
  assert.equal(
    classifyPage({ title: "settings", lines: ["settings"], charsCount: 500 }),
    "project-meta",
  );
  assert.equal(
    classifyPage({ title: "kofu", lines: ["kofu", "#member"], charsCount: 500 }),
    "profile",
  );
  assert.equal(
    classifyPage({ title: "未定：名称", lines: ["未定"], charsCount: 500 }),
    "stub",
  );
  assert.equal(
    classifyPage({ title: "Dreamcore", lines: ["Dreamcore"], charsCount: 500 }),
    "content",
  );
});

test("converts headings and links without embedding external media", () => {
  assert.equal(convertScrapboxLine("[** 概要]"), "## 概要");
  assert.equal(
    convertScrapboxLine("[参考 https://example.com/image.png]"),
    "[参考](https://example.com/image.png)",
  );
  assert.equal(
    convertScrapboxLine("[Dreamcore]"),
    `[Dreamcore](${sourcePageUrl("AestheticsWiki", "Dreamcore")})`,
  );
  assert.doesNotMatch(
    convertScrapboxLine("[https://example.com/image.png]"),
    /!\[/u,
  );
});

test("escapes raw HTML from imported lines", () => {
  assert.equal(
    convertScrapboxLine("<script>alert(1)</script>"),
    "&lt;script&gt;alert(1)&lt;/script&gt;",
  );
});

test("keeps imported wiki links as reproducible review candidates", async () => {
  const snapshot = JSON.parse(
    await readFile("source/cosense/AestheticsWiki.json", "utf8"),
  );
  const committedAudit = JSON.parse(
    await readFile("relations/cosense-link-audit.json", "utf8"),
  );
  const generatedAudit = buildRelationAudit(snapshot);

  assert.deepEqual(committedAudit, generatedAudit);
  assert.deepEqual(generatedAudit.counts, {
    sourceLinkReferences: 151,
    eligibleLinkReferences: 74,
    candidateRelations: 74,
    explicitWordingCandidates: 2,
    skippedLinks: 77,
  });
  assert.ok(
    generatedAudit.candidates.every(
      ({ reviewStatus }) =>
        reviewStatus === "unreviewed" || reviewStatus === "needs-evidence",
    ),
  );
  assert.ok(
    generatedAudit.candidates.every(
      ({ reviewStatus }) => reviewStatus !== "accepted",
    ),
  );
});

test("keeps provisional directed contexts tied to source-line evidence", async () => {
  const audit = JSON.parse(
    await readFile("relations/cosense-link-audit.json", "utf8"),
  );
  const curated = JSON.parse(
    await readFile("relations/context-relations.json", "utf8"),
  );
  const pageMap = JSON.parse(
    await readFile("source/cosense/page-map.json", "utf8"),
  );
  const evidenceIds = new Set(audit.candidates.map(({ id }) => id));
  const conceptIds = new Set(
    pageMap.pages.flatMap(({ conceptId }) => (conceptId ? [conceptId] : [])),
  );
  const pairs = new Set();

  assert.equal(curated.relations.length, 5);
  for (const relation of curated.relations) {
    assert.equal(relation.reviewStatus, "provisional");
    assert.ok(evidenceIds.has(relation.evidenceCandidateId), relation.id);
    assert.ok(conceptIds.has(relation.sourceConceptId), relation.id);
    assert.ok(conceptIds.has(relation.targetConceptId), relation.id);
    const pair = [relation.sourceConceptId, relation.targetConceptId]
      .sort()
      .join("\u0000");
    assert.ok(!pairs.has(pair), relation.id);
    pairs.add(pair);
  }

  assert.ok(
    curated.relations.some(
      ({ sourceConceptId, targetConceptId }) =>
        sourceConceptId.endsWith("/69998a0b58b8fa96506687d3") &&
        targetConceptId.endsWith("/6977f104df1b80cff76f6bf6"),
    ),
    "Old Web must point toward Webcore",
  );
});

test("does not promote imported link candidates to public related edges", async () => {
  const pageMap = JSON.parse(
    await readFile("source/cosense/page-map.json", "utf8"),
  );
  const conceptPages = pageMap.pages.filter(({ conceptId }) => conceptId);

  for (const page of conceptPages) {
    const conceptPath = resolve(dirname(page.outputPath), "concept.yaml");
    const metadata = JSON.parse(await readFile(conceptPath, "utf8"));
    assert.deepEqual(metadata.prerequisites, [], page.conceptId);
    assert.deepEqual(metadata.related, [], page.conceptId);
  }
});
