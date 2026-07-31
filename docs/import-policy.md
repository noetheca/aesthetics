# Cosense import policy

The committed JSON snapshot is the fidelity copy. Generated Markdown is a
review aid and may not represent every Cosense syntax feature.

The importer:

- uses the public page-list and page-detail endpoints at low concurrency;
- records source page IDs, titles, timestamps, line text, and link targets;
- checks that the page list did not change during a snapshot;
- removes user IDs, access metrics, and edit-history details;
- preserves external media as links without downloading it;
- derives noetheca IDs from stable source page IDs, never titles or paths;
- marks substantive pages `review` and incomplete pages `draft`;
- records same-project links as review-only candidates with source-line
  evidence instead of asserting prerequisite or historical relationships;
- places project administration and profile pages in `archive/cosense/`.

Cosense describes these endpoints as internal APIs that may change without
notice. The normalized snapshot allows future builds to remain independent
from API availability.

Relationship candidates are generated at
`relations/cosense-link-audit.json`. A plain wiki link defaults to
`associated-with`, `unreviewed`, and `unassessed`; it is not copied to a
concept's stored `related` list. Render-time related lines remain
selection-only and do not affect graph physics. A separately reviewed overlay
at `relations/context-relations.json` records provisional directions only when
the imported Markdown describes an influence, reference, lineage, or
development. See
[`relationship-model.md`](relationship-model.md) for the evidence and review
policy.
