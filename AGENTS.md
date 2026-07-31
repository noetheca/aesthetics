# AGENTS.md

Read the organization project brief before implementation:
`https://github.com/noetheca/.github/blob/main/docs/PROJECT_BRIEF.md`.

## Repository responsibilities

- Store aesthetics content, provenance, assets, and language-independent
  relationships.
- Keep shared presentation, parsing, validation, and UI in `knowledge-engine`.
- Preserve imported source text separately from best-effort Markdown
  conversions.

## Constraints

- Never derive a concept ID from its title, filename, locale, or URL.
- Treat imported content as `review` or `draft` until a human verifies it.
- Record source revision, permission basis, attribution, and modifications.
- Do not download or relicense third-party embeds merely because a page links
  to them.
- Use one Markdown body per locale; do not use MDX or raw HTML.
- Run `pnpm check` before handing off code or generated content changes.
