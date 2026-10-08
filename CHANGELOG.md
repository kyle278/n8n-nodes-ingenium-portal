# Changelog

## 0.1.4 — Direct SMS recipients and criteria loading

Node version 1.2 sends SMS to an explicit To Number without a Record ID, using an integration authorised for direct recipients and the organisation's existing SMS connector. Older node versions keep record-based recipients and permission checks.

Wait for a selected field before displaying or loading the operator picker. New criteria no longer request options prematurely or show a misleading load error.

## 0.1.3 — Schema-driven record filters

Add Get Many and Get by filters with repeatable criteria, All/Any matching, schema-provided operators, typed number/date/range inputs and schema picklist choices. Get by filters requires a unique match and returns the canonical record. Get Many returns individual records with pagination and limits. Schema Get can return objects keyed by API name, with node version 1.1 using that format by default and version 1 preserving array output. Existing Get by ID, advanced JSON Search and writes remain compatible. Node installation on n8n Cloud still awaits verification.

## 0.1.2 — Published verification candidate

Published from GitHub Actions using the official n8n CLI release command and npm Trusted Publishing. npm provenance and the official community package scanner passed on 8 October 2026. n8n review and full organisation runtime acceptance remain pending.

## 0.1.1 — Unpublished candidate

Publish through the package-specific GitHub Trusted Publisher with provenance. Includes the API-key node and built-in HTTP setup workflows. n8n verification and full organisation runtime acceptance remain pending; this release is not a claim of Cloud custom-node availability.

Fix the Cloud starters' origin validation to work in n8n's Code sandbox, where the `URL` constructor is unavailable.

## 0.1.0 — Initial preview

Initial organisation API-key credential and record, schema, SMS, state and operation receipt node, plus four built-in HTTP setup workflows. Preview release; n8n verification and organisation runtime acceptance remain pending. The initial npm bootstrap establishes package ownership; the verification candidate must be published from GitHub Actions with provenance.
