# Manual review video

The Creator Portal reported **Automated Review Complete / Manual Review Awaiting Video** on 8 October 2026 for the submitted package `n8n-nodes-ingenium-portal@0.1.2`.

The portal requires a single continuous recording, at most five minutes, made with proper screen recording software such as Loom. Voice-over is optional. It must show installing the submitted npm version, adding the node to a new workflow, creating and testing a credential, common actions, and one action used as an AI-agent tool.

## Preparation before recording

- Use a local or self-hosted n8n instance. The custom node cannot yet be installed on n8n Cloud.
- Install exactly `n8n-nodes-ingenium-portal@0.1.2` during the recording; rehearse on a separate instance first.
- Use a private demo organisation and dummy records. Do not show patient data, production API keys, provider secrets or personal identifiers.
- Prepare an expiring demo integration scoped to the demonstrated objects and operations. Keep the key masked while pasting; never put it in a workflow export.
- Prepare the model credential needed for the AI-agent example before recording. Its API key must remain masked.
- Rehearse the demo and verify each response before recording. A mocked response is not a substitute for demonstrating the real integration.
- Keep SMS disabled unless a specific test recipient and message have been approved.

## Suggested continuous recording

| Time | Demonstration |
| --- | --- |
| 0:00–0:40 | Open n8n Settings → Community nodes and install the submitted npm version. |
| 0:40–1:20 | Create a workflow, add Ingenium Portal, create the demo credential and show its successful connection test. |
| 1:20–2:00 | Show schema/object dropdowns, query a dummy object and get one dummy record. |
| 2:00–3:00 | Create a dummy record, update it with the expected model/row versions, and show the result. Use stable logical operation keys. |
| 3:00–3:40 | Set/get demo workflow state, rerun the identical write and show replay; inspect its operation receipt. |
| 3:40–4:40 | Connect Ingenium Portal to an AI Agent as a tool and execute one read-only schema or record query with the dummy data. |
| 4:40–5:00 | Show the available resources and explain that SMS dispatch requires a mapped affirmative permission field, a configured provider and a stable operation key. Do not claim an SMS was sent if it was not. |

Upload the original uncut video, or paste its accessible link, into the submitted package's Creator Portal page and select **Submit for review**. Video submission is still pending; automated checks passing does not constitute final approval.
