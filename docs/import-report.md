# AestheticsWiki import report

- Source project: <https://scrapbox.io/AestheticsWiki/>
- Snapshot time: 2026-07-31T06:22:18.647Z
- Source pages: 55
- Generated concepts: 49
- Archived project/profile pages: 6
- Generated static pages: 50, including the index

## Classification

| Classification | Count | Treatment |
|---|---:|---|
| Content | 41 | Knowledge concept, `review` |
| Stub | 8 | Knowledge concept, `draft` |
| Project metadata | 5 | Archive only |
| Contributor profile | 1 | Archive only |

The stub rule covers pages whose title starts with `未定：` or whose source
character count is below 200. Classification is reviewable in
`source/cosense/page-map.json`.

## Links and media

The source API reported 151 same-project link references. Of these, 74 resolve
unambiguously between imported content or stub concepts. They are recorded as
review-only candidates in `relations/cosense-link-audit.json`, not asserted as
`related`, prerequisite, influence, or inheritance relationships. The other
77 references point from/to non-concepts or unresolved pages and remain in the
audit and source Markdown.

Two candidates have explicit relationship wording in the imported text and
are provisionally classified as low-confidence `influenced-by` candidates.
They still require evidence and human review. See
[`relationship-model.md`](relationship-model.md).

The source text referenced 7 external image URLs, 212 external video URLs, and
2 `scrapbox.io/files` URLs during pre-import review. The importer converts these
to ordinary links. It generated no Markdown image embeds, raw active media
elements, or downloaded media files.

The aesthetics renderer may enhance a paragraph containing only YouTube video
links (`watch`, `youtu.be`, `shorts`, or `live`) into lazy,
privacy-enhanced embeds. This happens in an Astro remark plugin, keeps start
times, preserves the original link as a caption, and does not modify imported
Markdown. Channel, playlist, invalid, and inline citation links stay links.

## Known conversion limits

Cosense bracket syntax is converted on a best-effort basis. Headings, internal
links, cross-project links, and labeled external links are handled. Complex
nested decoration, layout-specific settings, and embeds may need manual
editing. The normalized source line text and SHA-256 for every page are kept so
reviewers can compare the adaptation with its snapshot.
