# Saved controls and fixture limits

Recovered without new upstream requests from local `prototype/issue-17` (`8a62b82`), `docs/prototypes/issue-17/inputs/`. Captures were made on 2 October 2026; dates embedded in filenames select vigenza, not capture time. Local branch availability is not a publication claim.

| Input | Role |
| --- | --- |
| `tuel-public.xml.gz`, `tuel-current-portal.html.gz` | Real ordered inventory with 295 occurrences, repeated main identifiers and supplied coordinates. |
| `civil-current.xml.gz`, `civil-2026-10-02-AKN-V-portal.html.gz` | Real component hierarchy, exact address crosswalk, and genuine component-heading disagreements which prevent blanket completeness. |
| `civil-direct-coordinate.json` | Raw independently captured OpenData article 2043 response; layer 2, supplied group 258 and extended coordinate 10. |
| `privacy-historical.xml.gz`, `privacy-2017-01-01-AKN-V-portal.html.gz` | Dated 2017 source/website controls. Sidebar future entries are not historical membership evidence. |
| `privacy-export-date-control.xml.gz` | Actual current-mode export requested with a historical date: a deliberate historical negative control. |
| `ordinary-public.xml.gz`, `privacy-current.xml.gz` | Retained ordinary/current source controls for future release comparisons. |

`tuel-details.json.gz` and `civil-main-control.json` are **synthetic detail envelopes**, rendered separately with Python ElementTree from the captured XML and paired with supplied portal coordinates. The TUEL table control retains its XML table tags and spans rather than flattening it into prose. They exercise parser/traversal, queue/attempt accounting and memory; they are not independently captured per-article API/version evidence. TUEL expected occurrence counts/selected labels come from the saved prototype inventory; the synthetic effective interval is a fixture, not a legal assertion. The 2017 website text is extracted from its captured displayed article; Gazette/detail envelope fields in that test are synthetic. Source-conflict negatives, validity boundaries, interruption and table fixtures are tested separately with literal independently specified expectations. Passing finite fixtures does not establish current official-surface availability or universal completeness.

Historical experiment `4053014` on local `research/issue-11-historical` additionally records that top-level dated V export returned current text, bounded M downloads failed, and Range was ignored. The stage deliberately adds no historical export fallback, range stitcher or local multiversion selector. Recover the original report with `git show 4053014:docs/research/issue-11-historical/live/findings.md`.

`tuel-direct-2026-10-05.json.gz` is an independently captured official OpenData article-13 response on 5 October 2026 for publication `2000-09-28 / 000G0304`, snapshot `2026-10-02`, base coordinates (`versione: 0`). Its subtitle omits the editorial code, while Gazette/issuance metadata and article text are present. This is a negative identity control: the current reader withholds it as `unresolved / source_identity_conflict`, never absence. The complete original JSON is retained; this capture does not certify that the response belongs to the requested exact publication.

With an authenticated identity independently returned by the saved official TUEL discovery, that same article-13 capture is now a positive direct/continuation control. Altered issuance, Gazette or supplement metadata remains withheld. The coordinate-only negative control above is unchanged.

`tuel-enactment-direct-2026-10-06.json.gz` is an independently captured OpenData response for the supplied first TUEL address (article 1, extended suffix 9, group 1, version 1), snapshot `2026-10-02`. The API encloses the decree's preamble inside the returned article body. Its text conflicts with the AKN first occurrence; direct reading must withhold that body without silently removing the preamble. The saved dated website independently renders the AKN first occurrence with exact full-text/table agreement and a covering validity interval, so it can verify the first index entry. This control supports that specific adapter behavior, not all unstructured API renderings.
