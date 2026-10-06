# Performance verification - 2026-10-06

- Developer task detail, same local record and authenticated APIClient: 9 SQL queries before, 6 after. Baseline permission lookup was temporarily restored with unittest.mock.patch for comparison; response status 200 in both runs.
- Empty chat polling: 1 SELECT, 0 UPDATE, empty response. Regression test checks the SQL count and partner isolation. Initial request keeps the 200-message window; subsequent requests use after=<last-id> and preserve cached messages.
- Server process count: 4 before, 2 after --noreload. Includes Windows virtualenv launchers. No comparable CPU/RAM or end-user latency benchmark was taken.
- Backend: 247 tests passed. Frontend: 103 tests passed with one worker. Initial two-worker run had a pre-existing PhotoModal timeout (102 passed); one-worker rerun passed all tests.
- TypeScript and production build passed. Runtime root HTTP 200 verified.

## Self-evaluation (agent-self-evaluation)

| Axis | Score | Evidence / improvement |
|---|---:|---|
| Accuracy | 4 | SQL counts and tests verify behavior; sustained CPU/RAM measurements would strengthen resource claims. |
| Completeness | 4 | Chat transfer, repeated permission queries and server watcher reduced; large-data browser profiling remains useful. |
| Clarity | 4 | Report distinguishes measured SQL/process savings from unmeasured overall speed. Add representative browser traces if needed. |
| Actionability | 5 | Changes implemented, production frontend built and local server restarted. |
| Conciseness | 4 | Short user handoff; details kept in this verification note. |

Overall: 4.2/5. Next improvements by impact: browser profiling with representative data; comparable sustained CPU/RAM sampling. Would the user agree? Likely with the verified changes; perceived speed still depends on their workload.
