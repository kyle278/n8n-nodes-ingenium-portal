const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const workflows = fs
	.readdirSync(path.join(__dirname, '../examples/cloud'))
	.filter((f) => f.endsWith('.json'))
	.map((f) => JSON.parse(fs.readFileSync(path.join(__dirname, '../examples/cloud', f))));
function execute(workflow, name, json, all) {
	const n = workflow.nodes.find((n) => n.name === name);
	return new Function('$input', 'URL', n.parameters.jsCode)(
		{
			first: () => ({ json }),
			all: () => all.map((json) => ({ json })),
		},
		undefined,
	);
}
test('Cloud starters cannot activate schedules, leak credentials, follow redirects or retry dispatch', () => {
	assert.equal(workflows.length, 4);
	for (const w of workflows) {
		assert.equal(w.active, false);
		assert.equal(w.settings.saveDataSuccessExecution, 'none');
		for (const n of w.nodes) {
			assert.ok(n.type.startsWith('n8n-nodes-base.'));
			assert.equal(n.credentials, undefined);
			assert.notEqual(n.type, 'n8n-nodes-base.scheduleTrigger');
			if (n.type.endsWith('.httpRequest')) {
				assert.equal(n.retryOnFail, false);
				assert.equal(n.parameters.genericAuthType, 'httpHeaderAuth');
				assert.equal(n.parameters.options.redirect.redirect.followRedirects, false);
			}
		}
	}
});
test('Audience coverage reports bounded truncation and deduplicates records', () => {
	const w = workflows.find((w) => w.name.startsWith('Preview'));
	const result = execute(w, 'Summarise audience coverage', {}, [
		{ records: [{ id: 'a' }, { id: 'a' }], page: 1, pageSize: 100, totalCount: 201 },
	])[0].json;
	assert.equal(result.truncated, true);
	assert.deepEqual(result.recordIds, ['a']);
	assert.equal(result.scannedRecords, 2);
	const complete = execute(w, 'Summarise audience coverage', {}, [
		{ records: [{ id: 'a' }], page: 1, pageSize: 100, totalCount: 1 },
	])[0].json;
	assert.equal(complete.truncated, false);
});
test('SMS test blocks by default and stops uncertain outcomes', () => {
	const w = workflows.find((w) => w.name.startsWith('Test one'));
	assert.throws(
		() => execute(w, 'Require an approved SMS test', { sendApprovedTest: false }),
		/disabled/,
	);
	assert.throws(() => execute(w, 'Inspect SMS outcome', { outcome: 'unknown' }), /not accepted/);
	assert.equal(
		execute(w, 'Inspect SMS outcome', { outcome: 'accepted' })[0].json.outcome,
		'accepted',
	);
});
test('HTTPS origin guard rejects credential-bearing and path URLs', () => {
	for (const origin of [
		'http://portal.example',
		'https://portal.example/path',
		'https://user:secret@portal.example',
		'https://portal.example/',
	])
		assert.throws(() => execute(workflows[0], 'Validate configuration', { portalOrigin: origin }));
	assert.equal(
		execute(workflows[0], 'Validate configuration', { portalOrigin: 'https://portal.example' })[0]
			.json.portalOrigin,
		'https://portal.example',
	);
});
