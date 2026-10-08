const { test } = require('node:test');
const assert = require('node:assert/strict');
const { IngeniumPortal } = require('../dist/nodes/IngeniumPortal/IngeniumPortal.node');
const { portalOrigin, pathPart } = require('../dist/nodes/IngeniumPortal/helpers');

function context(parameters, handler) {
	const calls = [];
	const ctx = {
		getInputData: () => [{ json: { source: 'test' } }],
		getNodeParameter: (name) => parameters[name],
		getCurrentNodeParameter: (name) => parameters[name],
		getNode: () => ({
			name: 'Portal test',
			type: 'ingeniumPortal',
			typeVersion: 1,
			parameters: {},
			position: [0, 0],
		}),
		getCredentials: async () => ({
			portalUrl: 'https://portal.example.test',
			apiKey: 'not-a-real-key',
		}),
		continueOnFail: () => false,
		helpers: {
			httpRequestWithAuthentication: async function (credential, options) {
				calls.push({ credential, ...options });
				return handler(options, calls.length);
			},
		},
	};
	return { ctx, calls };
}
const execute = (ctx) => new IngeniumPortal().execute.call(ctx);

test('search follows all pages and preserves n8n item links', async () => {
	const { ctx, calls } = context(
		{ resource: 'record', operation: 'search', object: 'contact', query: '{}', returnAll: true },
		(o) => ({
			records: Array.from({ length: o.body.query.page === 1 ? 100 : 1 }, (_, i) => ({
				id: `${o.body.query.page}-${i}`,
			})),
			totalCount: 101,
		}),
	);
	const [items] = await execute(ctx);
	assert.equal(items.length, 101);
	assert.equal(calls.length, 2);
	assert.equal(calls[1].body.query.page, 2);
	assert.deepEqual(items[100].pairedItem, { item: 0 });
});
test('search limit stops fetching and emits individual records', async () => {
	const { ctx, calls } = context(
		{
			resource: 'record',
			operation: 'search',
			object: 'contact',
			query: '{}',
			returnAll: false,
			limit: 2,
		},
		() => ({ records: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], totalCount: 1000 }),
	);
	const [items] = await execute(ctx);
	assert.equal(items.length, 2);
	assert.equal(calls.length, 1);
});
test('caller cannot override managed search pagination', async () => {
	const { ctx, calls } = context(
		{
			resource: 'record',
			operation: 'search',
			object: 'contact',
			query: '{"page":4}',
			returnAll: true,
		},
		() => ({}),
	);
	await assert.rejects(execute(ctx), /manages pagination/);
	assert.equal(calls.length, 0);
});
test('create sends typed fields and preserves the logical operation key', async () => {
	const { ctx, calls } = context(
		{
			resource: 'record',
			operation: 'create',
			object: 'contact',
			fields: {
				values: [
					{ fieldId: 'active', value: 'true' },
					{ fieldId: 'name', value: '"Example"' },
				],
			},
			modelVersion: 8,
			operationKey: 'contact:external-123',
		},
		() => ({ recordId: 'created' }),
	);
	await execute(ctx);
	await execute(ctx);
	assert.equal(calls[0].method, 'POST');
	assert.equal(calls[1].headers['Idempotency-Key'], calls[0].headers['Idempotency-Key']);
	assert.deepEqual(calls[0].body, {
		values: [
			{ fieldId: 'active', value: true },
			{ fieldId: 'name', value: 'Example' },
		],
		expectedModelVersion: 8,
	});
	assert.equal(calls[0].disableFollowRedirect, true);
});
test('duplicate fields are rejected before any mutation', async () => {
	const { ctx, calls } = context(
		{
			resource: 'record',
			operation: 'create',
			object: 'contact',
			fields: {
				values: [
					{ fieldId: 'name', value: 'null' },
					{ fieldId: 'name', value: 'null' },
				],
			},
		},
		() => ({}),
	);
	await assert.rejects(execute(ctx), /only be supplied once/);
	assert.equal(calls.length, 0);
});
test('state list follows cursor and optional due filter', async () => {
	const { ctx, calls } = context(
		{
			resource: 'state',
			operation: 'getMany',
			namespace: 'recalls',
			returnAll: true,
			dueBefore: '2026-10-08T00:00:00Z',
		},
		(_, n) => ({ items: [{ key: `key-${n}` }], nextCursor: n === 1 ? 'cursor-1' : null }),
	);
	const [items] = await execute(ctx);
	assert.equal(items.length, 2);
	assert.equal(calls[1].qs.after, 'cursor-1');
	assert.equal(calls[0].qs.dueBefore, '2026-10-08T00:00:00Z');
});
test('state cursor loop fails rather than requesting forever', async () => {
	const { ctx, calls } = context(
		{
			resource: 'state',
			operation: 'getMany',
			namespace: 'recalls',
			returnAll: true,
			dueBefore: '',
		},
		() => ({ items: [], nextCursor: 'same' }),
	);
	await assert.rejects(execute(ctx), /Repeated pagination cursor/);
	assert.equal(calls.length, 2);
});
test('uncertain SMS is never automatically retried or given a fresh key', async () => {
	const { ctx, calls } = context(
		{
			resource: 'sms',
			operation: 'send',
			recordId: 'recipient',
			message: 'Example',
			checks: '[]',
			operationKey: 'recall:recipient:2027',
		},
		() => {
			throw {
				statusCode: 409,
				response: {
					data: {
						error: 'Inspect its receipt',
						code: 'OPERATION_UNRESOLVED',
						operationId: 'operation-1',
					},
				},
				request: { headers: { Authorization: 'Bearer secret-must-not-leak' } },
			};
		},
	);
	await assert.rejects(
		execute(ctx),
		(e) =>
			/Inspect its receipt/.test(e.message) && !JSON.stringify(e).includes('secret-must-not-leak'),
	);
	assert.equal(calls.length, 1);
	assert.equal(calls[0].headers['Idempotency-Key'], 'recall:recipient:2027');
});
test('schema dropdowns reload per credential context and exclude protected fields', async () => {
	const options = new IngeniumPortal().methods.loadOptions;
	for (const org of ['first', 'second']) {
		const { ctx } = context({ object: 'contact' }, () => ({
			objects: [
				{
					key: 'contact',
					name: org,
					fields: [
						{ id: `${org}-name`, label: 'Name', type: 'text', editable: true },
						{ id: 'protected', label: 'Owner', type: 'text', editable: false },
					],
				},
			],
		}));
		assert.equal((await options.getObjects.call(ctx))[0].name, org);
		assert.deepEqual(
			(await options.getFields.call(ctx)).map((f) => f.value),
			[`${org}-name`],
		);
	}
});
test('portal origin validation and path encoding prevent URL confusion', () => {
	assert.equal(portalOrigin('https://portal.example.test/'), 'https://portal.example.test');
	for (const url of [
		'http://portal.test',
		'https://user:secret@portal.test',
		'https://portal.test/api',
		'https://portal.test?key=secret',
	])
		assert.throws(() => portalOrigin(url));
	assert.equal(pathPart('client/key?org=other'), 'client%2Fkey%3Forg%3Dother');
	assert.throws(() => pathPart('..'));
});
