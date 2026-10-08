# n8n-nodes-ingenium-portal

For immediate n8n Cloud setup, use the [built-in HTTP workflows](examples/cloud/README.md). They do not require installing this custom node. Custom-node Cloud availability remains subject to n8n verification.

Connect n8n workflows to an organisation in Ingenium Portal. Read and update CRM records, send SMS through the organisation's configured connector and keep durable workflow state using the portal's organisation integration API.

**Published preview:** available on npm for local/self-hosted n8n. n8n Cloud installation still requires verification. The API can already be used on Cloud with HTTP Request nodes.

## Operations

| Resource          | Operations                                    |
| ----------------- | --------------------------------------------- |
| Record            | Create, Get, Get Many, Search, Update         |
| Schema            | Get allowed objects, fields and options       |
| SMS               | Send to a number; optional eligibility checks |
| Workflow state    | Get, Get Many, Set                            |
| Operation receipt | Get                                           |

Object, editable field and filter dropdowns load from the selected credential's organisation. Get Many provides schema-driven field/operator/value criteria, All/Any matching, typed date/number inputs and picklist choices. Get can match by ID or criteria; criteria must match exactly one record. Get Many, Search and state lists return individual n8n items, preserve item linking and support pagination. Search retains JSON for advanced nested queries; create/update field values use JSON inputs. Deletes, bulk writes, files, webhooks and confirmed SMS delivery are outside this version.

## Credentials

1. In the portal, open Organiser → Organisations → your organisation → Connectors → Integration API (organisation owners/admins can also use Settings → Connectors).
2. Create an integration with an active service member, allowed objects and the scopes needed by the workflow. Include `schema.read` for connection testing and dropdowns.
3. In n8n, create an **Ingenium Portal API** credential. Enter the portal HTTPS origin and the integration key; omit the `Bearer` prefix.
4. Test the connection and choose this credential on your nodes. Use separate credentials for each organisation. Their organisation cannot be changed with a node input.

Keys use the lifetime selected in the portal, including Until revoked. For rotation, issue a replacement, update/test the n8n credential and revoke the old key. Never put a key in workflow JSON. This version does not accept a portal password or implement OAuth. Portal consent and token endpoints will live in the separate `ingeniumportal` repository; this package will gain an OAuth credential after those are available.

## Usage and recovery

- Schema Get: new node version 1.1 returns `objects.contact`, `objects.opportunity`, etc. Select **Object Output Format → Array** for indexed entries. Existing node version 1 keeps its original array default and can also switch to names. These are the schema API names (usually singular).
- Get Many: choose an object, click **Add Criterion**, then choose a field, operator and value. Picklists show schema options, including inactive choices for historical filtering. Use **All Criteria** or **Any Criteria**, and set Limit or Return All. An empty criteria list returns all accessible records up to the limit. Schema type/operator/option changes are checked before execution.
- Get: choose **Match By → Filters** for a unique record lookup, or **Record ID** for the existing direct lookup. No matches or multiple matches produce an error; use Get Many when multiple matches are expected.
- Search: choose an object, set Limit or Return All, and optionally provide a portal query such as `{"search":"example"}`. The node manages `page` and `pageSize`; do not include those in the query JSON. Offset paging is not a snapshot; edits during scanning can change results.
- Create/update: choose fields and supply JSON values (`"text"`, `true`, `123`, `null`, or arrays of IDs). Supply the published model version where required. Update requires the current row version. Re-read after a version conflict before making a new intended change.
- Every mutation requires a **Logical Operation Key**. Use a stable record/campaign/cycle key. Keep it unchanged when repeating the same request after a lost response. Use a new key only for a genuinely new intended operation.
- SMS: new node version 1.2 uses **To Number**, including the country code. Enable `sms.send` and choose **SMS recipients → Direct numbers from the workflow** when creating its portal integration. Check recipient permission/eligibility in the workflow. Older nodes retain record-based sends; existing grants are not expanded automatically.
- Record-based SMS uses the portal integration's configured recipient, phone and affirmative permission fields and organisation SMS connector. `accepted` means provider acceptance, not delivery. `unknown`/pending outcomes must be reconciled through portal operation history; do not change keys to bypass them.
- The node does not automatically retry requests. For 429, wait before retrying. Inspect write/SMS receipts after ambiguous failures. n8n's Retry On Fail must retain the same logical key. Avoid unnecessary personal data in execution history.
- Return All may use substantial n8n memory; use Limit for bounded scans.

## Development

Generated with the official `n8n-node` CLI. Install dependencies, then run:

```sh
npm ci --ignore-scripts
npm run lint
npm test
npm run dev
```

`npm run dev` uses the CLI's isolated local n8n development environment. The repository has no runtime dependencies; `n8n-workflow` is a peer supplied by n8n. Compilation targets SDK 2.42.2; runtime compatibility with the target Cloud version must be tested before release. Use a Node version supported by the pinned development tools (Node 24.15+ recommended).

## Publication

See [the publishing checklist](docs/publishing.md). GitHub Actions validates code on pushes/PRs. Version tags run the publication workflow with npm provenance. Configure npm publishing access before tagging a release. The repository and MIT licence are public; publishing to npm does not itself make the node available on Cloud. Submit the published package to the [n8n Creator Portal](https://creators.n8n.io/nodes) and wait for verification.

## Resources

- [Creator Hub](https://n8n.notion.site/n8n-Creator-hub-7bd2cbe0fce0449198ecb23ff4a2f76f)
- [Node verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines/)
- [Node submission and provenance](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes/)
- [Changelog](CHANGELOG.md)
