import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  extractAestheticsContext,
  extractChronologyAnchor,
  extractGraphThumbnail,
  extractPeriodRaw,
} from "../src/lib/aesthetics-context.ts";

async function markdownFiles(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await markdownFiles(path)));
    } else if (entry.name === "ja.md") {
      paths.push(path);
    }
  }
  return paths;
}

test("preserves the displayed period without guessing missing or ambiguous values", () => {
  assert.equal(extractPeriodRaw("## 概要\n時期：00年代？\n"), "00年代？");
  assert.equal(extractPeriodRaw("## 概要\n時期：不明\n"), "不明");
  assert.equal(extractPeriodRaw("## 概要\n説明だけです。\n"), "記載なし");
  assert.equal(extractPeriodRaw("## 概要\n時期：   \n"), "記載なし");
});

test("uses the earliest explicit four-digit year as the chronology anchor", () => {
  assert.equal(
    extractChronologyAnchor("時期：1995年～、2020年～（リバイバル）"),
    1995,
  );
  assert.equal(
    extractChronologyAnchor("時期：2020年～、（ジョーク: 3000年～）"),
    2020,
  );
  assert.equal(extractChronologyAnchor("時期：00年代？\n説明：2002年頃"), undefined);
  assert.equal(extractChronologyAnchor("時期：不明"), undefined);
});

test("extracts chronology anchors for the 43 currently explicit concepts", async () => {
  const files = await markdownFiles(resolve("concepts"));
  const bodies = await Promise.all(
    files.map((path) => readFile(path, { encoding: "utf8" })),
  );

  assert.equal(files.length, 49);
  assert.equal(
    bodies.filter((body) => extractChronologyAnchor(body) !== undefined).length,
    43,
  );
});

test("prefers an explicit HTTPS image over an earlier YouTube video", () => {
  const markdown = [
    "[video](https://www.youtube.com/watch?v=xUwJWv38FpY)",
    "[cover](https://images.example.test/cover.webp?size=large)",
  ].join("\n");

  assert.equal(
    extractGraphThumbnail(markdown),
    "https://images.example.test/cover.webp?size=large",
  );
});

test("falls back to the first HTTPS YouTube video but ignores channel and playlist URLs", () => {
  const markdown = [
    "https://www.youtube.com/channel/UC1234567890",
    "https://www.youtube.com/playlist?list=PL1234567890",
    "https://youtu.be/xUwJWv38FpY?si=example",
    "https://www.youtube.com/watch?v=NATWXdEdBrQ",
  ].join("\n");

  assert.equal(
    extractGraphThumbnail(markdown),
    "https://i.ytimg.com/vi/xUwJWv38FpY/hqdefault.jpg",
  );
});

test("requires HTTPS media and returns a combined context", () => {
  assert.equal(
    extractGraphThumbnail(
      "http://example.test/cover.png\nhttp://youtu.be/xUwJWv38FpY",
    ),
    undefined,
  );
  assert.deepEqual(
    extractAestheticsContext(
      "時期：1970年、2025年\nhttps://example.test/expo.jpg",
    ),
    {
      periodRaw: "1970年、2025年",
      chronology: 1970,
      thumbnail: "https://example.test/expo.jpg",
    },
  );
});
