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
- places project administration and profile pages in `archive/cosense/`.

Cosense describes these endpoints as internal APIs that may change without
notice. The normalized snapshot allows future builds to remain independent
from API availability.
