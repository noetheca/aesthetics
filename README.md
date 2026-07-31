# noetheca aesthetics

The noetheca domain repository for Internet aesthetics and related cultural
forms.

The first import is based on the public
[美学ウィキ](https://scrapbox.io/AestheticsWiki/) project with direct
permission reported by the repository setup requester. Imported pages remain
under review and retain source attribution.

## Import snapshot

The 2026-07-31 snapshot contains 55 source pages:

- 41 substantive pages imported with `review` status;
- 8 incomplete or explicitly undecided pages imported with `draft` status;
- 5 project-operation pages and 1 contributor profile preserved in the
  archive, outside the knowledge graph.

The normalized source snapshot is committed under `source/cosense/`. External
images and videos remain links; no external media binaries are stored here.
At render time, a paragraph consisting only of supported YouTube video links
is presented through lazy, privacy-enhanced `youtube-nocookie.com`
embeds with captions linking to the original URLs. Inline citation links and
unsupported YouTube pages remain ordinary links, and source Markdown stays
free of raw iframes.
See [`docs/import-report.md`](docs/import-report.md) and
[`docs/import-policy.md`](docs/import-policy.md).

## Development

Place this repository next to `knowledge-engine`, then run:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm dev
```

To refresh from the public project API:

```sh
pnpm import:cosense
```

To reproduce generated files without network access:

```sh
node scripts/import-cosense.mjs --snapshot source/cosense/AestheticsWiki.json
```

## Licensing

Site code is licensed under MPL 2.0. Knowledge content, normalized source
snapshots, and import archives are licensed under CC BY-SA 4.0 where the
recorded permission applies. External linked media is not copied or relicensed.
See [`LICENSING.md`](LICENSING.md).
