# Document tracking acceptance test

Use newly registered test documents and separate browser profiles/devices for each office.

## Preparation

- Start the API and web app with `run.bat`. It prints both the local URL and the current LAN URL. Sign in with real configured accounts; there is no mock login or local-only save mode.
- Use three distinct active offices A, B, and C. A is the registering office. Create a fourth office account X for wrong-office checks.
- For phone camera tests, open the HTTPS network URL printed by `run.bat`. The first visit may require accepting the development certificate warning. Plain HTTP on a LAN IP cannot request camera access. Desktop localhost and manual code entry remain available.
- Run `npm test`, `npm run typecheck:server`, `npx tsc --noEmit`, and `npm run build` for automated checks. MySQL integration tests require permission to create/drop a temporary `doctrack_test_*` database. They do not migrate or seed the application database.

## Main journey

1. At A, register a document with title, subject, requester, pages, type, and priority. Save once. Verify it remains in A's custody with no destination, its deadline uses the priority service level, and its QR and registration event are present. Reprinting must retain the same identifiers.
2. Scan at A. Registration already establishes origin custody, so this opens **Confirm dispatch**. Cancel: no status/event changes. Scan again and confirm B: status becomes **in transit**, with A as sender and B as destination.
3. At B, scan once. Receipt is saved automatically, with one received event and no extra receipt button. B becomes current office; the pending destination is cleared.
4. Scan the same label deliberately again at B. Select C in the dispatch modal. Keeping the QR in the camera frame must not generate another action. Cancel and verify unchanged custody.
5. Scan again and confirm dispatch. At C, scan once to receive. Verify all offices' views update within 10 seconds or after returning focus to the tab.
6. At C, mark completed. File to a named cabinet/drawer/folder. Verify location, completed/filed timeline entries, archive search and public tracking. Further scans must offer no receive/dispatch action.

## Exceptions and consistency

| Scenario                                                      | Expected result                                                                   |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Unknown QR / malformed payload                                | No mutation; clear error                                                          |
| Scan at X when B is expected                                  | Wrong-office message; report adds an event but never transfers custody            |
| Sender rescans while in transit                               | No second dispatch                                                                |
| Two users receive/dispatch simultaneously                     | At most one successful transition and one corresponding custody event             |
| Network failure / expired session                             | Error, no invented receipt or dispatch; reload shows server state                 |
| Registration response lost then retry                         | Same registration request returns the existing document                           |
| Dispatch to current or inactive office                        | Rejected                                                                          |
| Hold without remarks                                          | Rejected; valid hold blocks dispatch/completion until processing resumes          |
| Return from B with a reason                                   | In transit to A; A must scan to receive                                           |
| Repeated transfer through X                                   | X receives custody and may select any other active office when dispatching        |
| Complete from an office without current custody               | Rejected, including for administrators assigned to another office                 |
| Complete while in transit or on hold / file before completion | Rejected                                                                          |
| Registry searches and exports                                 | QR, tracking code, title and requester match; CSV contains the filtered rows only |
| Unrelated office direct link or API search                    | No access to full records; participating offices retain history access            |
| One user reads notification                                   | Another recipient's read state remains unchanged                                  |
| Report date/office filters                                    | Preview and CSV match; transmittal reflects sender events, not current custody    |

## Interpretation

Scan actions are selected from persisted custody state, never from a global scan counter. Each arrival begins a new receive/dispatch cycle. The current custody office completes the document explicitly from its record before filing; scanning alone never completes or files it.

Reports use UTC calendar date filters. SLA due dates are assigned at registration from the selected priority's configured hours. There is no automatic escalation service; office staff must act on overdue/held records. Historical records without complete events cannot provide complete handling-time metrics.
