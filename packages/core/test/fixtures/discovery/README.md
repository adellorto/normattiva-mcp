# Discovery evidence fixtures

Captured on 5 October 2026 from the official production surface, after the stages 1/2 deterministic suite passed at `3f75ff5`. These fixtures support source-shape and identity regressions, not present-day legal advice or a guarantee of permanent ordering/counts.

| File | Source and input | Use and limitation |
| --- | --- | --- |
| `codes-2026-10-05.html.gz` | `https://www.normattiva.it/staticPage/codici`, public GET | Reviewed common-code names, dated official URNs and procurement generations. A page capture/review date does not certify continuing legal force. |
| `cad-exact-2026-10-05.json` | OpenData `/ricerca/avanzata`: `DECRETO LEGISLATIVO`, year `2005`, number `82`, `recente`, page 1, size 5 | Exact CAD publication/type/year/number/date response; one sampled match. |
| `tuel-exact-2026-10-05.json` | Same advanced endpoint: `DECRETO LEGISLATIVO`, year `2000`, number `267`, `recente`, page 1, size 5 | Independently verifies the supplemented TUEL citation and publication. |
| `transparency-simple-2026-10-05.json` | OpenData `/ricerca/semplice`: `testoRicerca="trasparenza amministrativa"`, `rilevante`, page 1, size 5 | Observed relevance response shape/order. No contractual relevance score, tie-break or frozen search snapshot exists. |
| `routing-cases.json` | Local `prototype/issue-18`, commit `8f1f824`, `docs/prototypes/issue-18/openrouter-routing-eval.mjs`, the `scenarios` data array | The accepted 10 core and 18 edge routing requests, replayed through the production module. Their prior model results are not new production model runs. |

The OpenData base is `https://api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1`. Each capture uses a bounded request and no credentials; four paced calls were made, without load testing. The Codes page seeds a small manually reviewed subset in `act-aliases.ts`; TUEL's alias provenance uses its independently reviewed official URN. Synthetic records/negative responses in tests deliberately vary identity, date, pagination, size and transport failures. They do not purport to be actual legal documents.
