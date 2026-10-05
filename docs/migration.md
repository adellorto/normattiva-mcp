# Coordinated pre-1.0 migration

This guide describes the unpublished replacement source interface. Stages 1–4 are implemented locally and candidate 0.2.0 is aligned; [release acceptance remains incomplete](implementation/release-acceptance.md) in [Validate coordinated release and prepare publication handoff](https://github.com/adellorto/normattiva-mcp/issues/22). Existing npm/hosted deployments remain on the previous interface until the user publishes. No permanent compatibility tools or v2 variants are added.

## Before starting

Set `NORMATTIVA_REFERENCE_KEY` to a preserved, cryptographically generated 32-byte key encoded as exactly 64 hex characters. Generate once with `openssl rand -hex 32`, save in the process/deployment configuration, and reuse on ordinary restart. The server does not read `.env` automatically. The key must never be a new random value per invocation. Remote clients do not need the hosted server's key.

Locators/cursors from compatible copies transfer only when format versions and signed-reference trust agree. `a1_` act locators identify a validated publication; `n1_` reading references/cursors and `d1_` discovery cursors are signed. Losing/changing trust invalidates signed references. Tampering, unsupported versions, operation mismatch and untrusted references reject explicitly; there is no silent restart.

## Replace calls and result handling

| Removed public input or behavior | Replacement |
| --- | --- |
| `search_acts` with `testo`, `titolo`, `denominazione`, number/year, upstream class/date filters | `find_acts({request})` preserving the complete citation, topic and explicit supported constraints in one request. Advanced routing remains internal. |
| Search `page`, `per_page`, `order` or reconstructed upstream query | `continue_acts({cursor})` using the literal returned cursor. Public discovery uses five candidates per page; search is a live corpus. |
| Reading `data_gu`, `codice_redazionale`, numeric `articolo` and suffix/group/version coordinates | Select an `act_locator` from discovery or updates, then pass `article_reference`; for exact suffix/attachment/repeated occurrences select an `article_locator` from `list_articles`. |
| Reading `data_vigenza` | Initial `snapshot_date` in ISO YYYY-MM-DD. Omitted dates resolve to a concrete UTC date. Exact references and cursors retain their date; do not mix them with a date override. |
| `include_suffixes`, `max_articoli`, `articolo_da` and `articolo_successivo` | Verified ordered occurrences and literal, operation-specific cursors. Resume the same reading/index tool with only `cursor` and an optional page/text budget. |
| `format: "html"` | Bounded verified text; `read_act` preserves table cells/relationships. There is no caller-selectable HTML mode. |
| `found` boolean / old top-level article text and vigenza fields | `outcome`, `reason`, `requested`, `evidence`; found text in `content.text`, dates in `content.effective_from/to`. |
| `truncated`, `stopped_early`, guessed article ranges / completion from misses | `pending`, `more`, `complete` or `interrupted`; `coverage` separately qualifies inventories and legal content. |
| Raw coordinates in `recent_updates` as the reading handoff | Each update supplies `act_locator`; amendment metadata remains distinct from new Gazette publication and read legal content. |

Discovery returns `match: identified/candidates/no_candidates`, `interpretation`, separated `article_reference` when present, ordering, live corpus and bounded `traversal.items`. Select explained candidates rather than guessing. Current legal force is unknown unless supported by official evidence; reviewed aliases only establish identity. Exact misses never relax to topics; empty searches never establish legal absence.

Article `outcome: absent` requires positive evidence and `absence_basis`. `unresolved`, an empty page or an upstream failure cannot prove absence. Found text can itself be paginated: inspect top-level `progress` and `cursor`. Index and whole-act pages use `traversal.progress/cursor` and `items`. Do not merge responses by article number: repeated labels, suffixes and table-cell positions remain distinct.

Successful structured JSON and text JSON agree. Typed operational errors use `isError: true`, `structuredContent.error` and compact safe text; SDK schema failures can use its ordinary validation error. Interrupted composed work preserves the successful prefix with `failure.error`, first unfinished position and a continuation. Copy references literally, never interpret or fabricate them. Every continuation receives a fresh attempt/deadline allowance and retains its snapshot/representation/position.

## Example workflows

```json
{"name":"find_acts","arguments":{"request":"decreto legislativo 267/2000 articolo 13"}}
{"name":"read_article","arguments":{"act_locator":"<candidate.act_locator>","article_reference":"13","snapshot_date":"2026-10-02"}}
{"name":"read_article","arguments":{"cursor":"<article.cursor>","max_chars":16000}}
```

```json
{"name":"list_articles","arguments":{"act_locator":"<candidate.act_locator>","snapshot_date":"2026-10-02","page_size":30}}
{"name":"list_articles","arguments":{"cursor":"<page.traversal.cursor>"}}
{"name":"read_article","arguments":{"article_locator":"<entry.article_locator>"}}
{"name":"read_act","arguments":{"act_locator":"<candidate.act_locator>","attachment_ref":"<entry.attachment_ref>","snapshot_date":"2026-10-02"}}
```

Placeholders represent exact returned values; they are not runnable references. `read_article` with a known ordinary reference remains a one-request path without mandatory indexing. Suffixed or structured references may need an exact listed occurrence; unresolved responses explain the next step.

## Check coverage and budgets

Defaults/maxima: discovery 5/20 (maximum internal only), index 30/50 entries, text 16,000/64,000 Unicode characters, full MCP serialized response 128 KiB, decoded source 24 MiB. Shared upstream work is sequential per process, with 50 seconds per call, 20 seconds per attempt and two direct or sixteen composed attempts. Do not remove safeguards to complete a crawl in one call.

A completed traversal does not automatically imply complete legal content. Inspect coverage and unread attachment references. Unread graphics/PDFs are not interpreted; preface/preamble/conclusion content lacks independent reading controls; source conflicts cannot be overwritten by a successful transport response. Tables require structured `read_act` output. Search remains live across pages, unlike frozen reading snapshots.

The opt-in research prompt selects actual headings, bounds normal research to 3 acts/10 articles, cites only read content and reports coverage. Essential guidance also works without prompts/resources. The smoke command is now `node tests/smoke.mjs` after building and configuring the preserved key. It fails on upstream unavailability. Stage 5 has passed isolated npm packaging and local fresh-process HTTP trust-transfer checks; deployed packaging, live-source and full model/runtime acceptance remain open. Candidate version preparation does not authorize publication.
