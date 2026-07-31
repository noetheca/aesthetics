import assert from "node:assert/strict";
import test from "node:test";
import youtubeEmbeds, {
  parseYouTubeVideoUrl,
  renderYouTubeEmbed,
} from "../src/markdown/youtube-embeds.mjs";

const link = (url, label = url) => ({
  type: "link",
  url,
  children: [{ type: "text", value: label }],
});

test("parses supported YouTube video URLs and preserves start seconds", () => {
  assert.deepEqual(
    parseYouTubeVideoUrl(
      "https://www.youtube.com/watch?v=abcdefghijk&t=1m30s",
    ),
    {
      videoId: "abcdefghijk",
      start: 90,
      sourceUrl:
        "https://www.youtube.com/watch?v=abcdefghijk&t=1m30s",
    },
  );
  assert.equal(
    parseYouTubeVideoUrl("https://youtu.be/abcdefghijk?start=42")?.start,
    42,
  );
  assert.equal(
    parseYouTubeVideoUrl("https://youtube.com/shorts/abcdefghijk")?.videoId,
    "abcdefghijk",
  );
  assert.equal(
    parseYouTubeVideoUrl("https://youtube.com/live/abcdefghijk#t=2:03")?.start,
    123,
  );
});

test("does not embed channels, playlists, or invalid video paths", () => {
  assert.equal(
    parseYouTubeVideoUrl("https://youtube.com/channel/abcdefghijk"),
    undefined,
  );
  assert.equal(
    parseYouTubeVideoUrl("https://youtube.com/playlist?list=abcdefghijk"),
    undefined,
  );
  assert.equal(
    parseYouTubeVideoUrl("https://youtube.com/watch?list=playlist-only"),
    undefined,
  );
});

test("renders privacy-enhanced lazy embeds with an escaped source caption", () => {
  const html = renderYouTubeEmbed(
    link(
      "https://youtu.be/abcdefghijk?t=9&list=PLdemo",
      'Title <demo> & "quote"',
    ),
  );
  assert.match(
    html,
    /src="https:\/\/www\.youtube-nocookie\.com\/embed\/abcdefghijk\?start=9"/u,
  );
  assert.match(html, /loading="lazy"/u);
  assert.match(html, /referrerpolicy="strict-origin-when-cross-origin"/u);
  assert.match(html, /allowfullscreen/u);
  assert.match(
    html,
    /href="https:\/\/youtu\.be\/abcdefghijk\?t=9&amp;list=PLdemo"/u,
  );
  assert.match(html, /Title &lt;demo&gt; &amp; &quot;quote&quot;/u);
  assert.doesNotMatch(html, /<demo>/u);
});

test("transforms a standalone video link without changing inline citations", () => {
  const standalone = {
    type: "root",
    children: [
      {
        type: "paragraph",
        children: [link("https://youtube.com/watch?v=abcdefghijk")],
      },
    ],
  };
  youtubeEmbeds()(standalone);
  assert.equal(standalone.children[0]?.type, "html");

  const inline = {
    type: "root",
    children: [
      {
        type: "paragraph",
        children: [
          { type: "text", value: "引用: " },
          link("https://youtube.com/watch?v=abcdefghijk", "video"),
        ],
      },
    ],
  };
  const before = structuredClone(inline);
  youtubeEmbeds()(inline);
  assert.deepEqual(inline, before);
});

test("transforms consecutive video-only lines without treating prose as media", () => {
  const videos = {
    type: "root",
    children: [
      {
        type: "paragraph",
        children: [
          link("https://youtube.com/watch?v=abcdefghijk"),
          { type: "text", value: "\n" },
          link("https://youtu.be/lmnopqrstuv"),
        ],
      },
    ],
  };
  youtubeEmbeds()(videos);
  assert.equal(videos.children[0]?.type, "html");
  assert.equal(
    [...videos.children[0].value.matchAll(/<iframe\b/gu)].length,
    2,
  );

  const mixed = {
    type: "root",
    children: [
      {
        type: "paragraph",
        children: [
          link("https://youtube.com/watch?v=abcdefghijk"),
          { type: "text", value: " and commentary" },
        ],
      },
    ],
  };
  const before = structuredClone(mixed);
  youtubeEmbeds()(mixed);
  assert.deepEqual(mixed, before);
});
