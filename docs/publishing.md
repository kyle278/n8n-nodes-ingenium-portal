# Publishing and verification checklist

Reviewed on 8 October 2026 against the user-supplied [Creator Hub](https://n8n.notion.site/n8n-Creator-hub-7bd2cbe0fce0449198ecb23ff4a2f76f), its [template submission rules](https://n8n.notion.site/Template-submission-guidelines-9959894476734da3b402c90b124b1f77), [sticky-note rules](https://n8n.notion.site/Sticky-note-guidelines-for-templates-2aa5b6e0c94f8058b0aefddd02655887), and the separate official node verification/UX documentation. Template creator verification and node verification are different processes.

## Node package gate

- Public source under `kyle278`; npm repository metadata must match.
- MIT licence, TypeScript, official CLI scaffold, strict Cloud lint configuration.
- One service, no external runtime dependencies, no filesystem/environment access in runtime node code, no secret logging.
- Credentials masked; service errors cleaned before reaching workflow output. No hardcoded secrets or live identifiers in examples.
- Build, lint, tests, clean package inspection, local n8n UI test and target-version compatibility check.
- Before submission: authenticate with two dummy organisations; test dropdown isolation, reads, writes, schema/row conflicts, key expiry/revocation, state pagination/versioning, rate limits and SMS unknown/replay behaviour. Do not test actual messages without an approved test recipient.
- Run the community package scanner before submission and fix findings. Automated checks are not an approval guarantee.
- Review public documentation and example workflow screenshots.
- Configure npm Trusted Publisher for owner `kyle278`, repository `n8n-nodes-ingenium-portal`, workflow `publish.yml`, or a package-limited granular token in GitHub's `NPM_TOKEN` secret. The npm account owner must complete first-package access/bootstrap; do not paste tokens into chat.
- Update package version and changelog, tag `v<version>` only when ready. Publish through GitHub Actions with provenance; do not publish locally.
- Submit the published package at https://creators.n8n.io/nodes. Cloud installation remains unavailable until n8n accepts it.

## Example/template gate

- Original practical workflow; clear English/Markdown and objective action-based title with relevant node names.
- Description around 200 words covering audience, behaviour, setup, requirements and customization.
- Exactly one yellow overview sticky in the top-left, 100–300 words, with `### How it works` and `### Setup`. Include the description there.
- White section stickies grouping multiple nodes for workflows with four or more functional nodes; under 50 words each.
- Rename nodes to explain their purpose. Group configurable variables in an Edit Fields node where relevant.
- Strip credentials, real emails, record/field IDs, pinned data and instance identifiers from exported JSON. Use n8n credentials, never hardcoded HTTP keys.
- Include a workflow image at the top of descriptions for community-node workflows. Before node verification, state that these examples require self-hosting/local development. After verification, recheck the Creator Hub's community-node guidance before claiming Cloud template compatibility.
- Validate imported workflow wiring and runtime behaviour before submission. A Loom walkthrough is optional.

## Portal boundary

OAuth consent UI, organisation grants, token/refresh/revocation handling and portal authentication changes belong in `ingeniumportal`. This repository owns node/credential classes, node-side HTTP behaviour, examples and package publication. Do not copy portal application code or credentials into this public repository.
