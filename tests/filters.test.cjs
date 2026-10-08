const { test } = require('node:test');
const assert = require('node:assert/strict');
const { IngeniumPortal } = require('../dist/nodes/IngeniumPortal/IngeniumPortal.node');
const {
	buildFilters,
	fieldToken,
	filterProperties,
} = require('../dist/nodes/IngeniumPortal/filters');
const { NodeHelpers } = require('n8n-workflow');
const fields = [
	{
		id: 'name',
		label: 'Name',
		type: 'text',
		editable: true,
		filterable: true,
		filterOperators: ['equals', 'contains', 'is_empty'],
	},
	{
		id: 'amount',
		label: 'Amount',
		type: 'formula',
		resultType: 'currency',
		editable: false,
		filterable: true,
		filterOperators: ['greater_than', 'between'],
	},
	{
		id: 'date',
		label: 'Date',
		type: 'date',
		editable: true,
		filterable: true,
		filterOperators: ['after', 'between', 'today', 'last_x_days'],
	},
	{
		id: 'status',
		label: 'Status',
		type: 'single_select',
		editable: true,
		filterable: true,
		filterOperators: ['equals', 'is_empty'],
		options: [
			{ id: 'o1', label: 'Open', active: true },
			{ id: 'o2', label: 'Closed', active: false },
		],
	},
	{
		id: 'tags',
		label: 'Tags',
		type: 'multi_select',
		editable: true,
		filterable: true,
		filterOperators: ['includes_all'],
		options: [{ id: 'tag', label: 'Tag', active: true }],
	},
	{
		id: 'flag',
		label: 'Flag',
		type: 'boolean',
		editable: true,
		filterable: true,
		filterOperators: ['is_true', 'is_false'],
	},
];
function ctx(parameters, handler) {
	const calls = [];
	return {
		calls,
		context: {
			getInputData: () => [{ json: {} }],
			getNodeParameter: (n) => parameters[n],
			getCurrentNodeParameter: (n) => parameters[n],
			getNode: () => ({
				name: 'test',
				type: 'ingeniumPortal',
				typeVersion: 1,
				parameters,
				position: [0, 0],
			}),
			getCredentials: async () => ({ portalUrl: 'https://example.test', apiKey: 'test' }),
			continueOnFail: () => false,
			helpers: {
				httpRequestWithAuthentication: async function (c, o) {
					calls.push(o);
					return o.url.endsWith('/schema')
						? { objects: [{ key: 'contact', name: 'Contact', fields }] }
						: handler(o);
				},
			},
		},
	};
}
test('criteria convert typed values and All/Any groups without sending display tokens', () => {
	const group = buildFilters(
		fields,
		[
			{ field: 'text|name', operator: 'contains', textValue: 'John' },
			{ field: 'currency|amount', operator: 'between', numberValue: 2, numberEnd: 10 },
			{ field: 'date|date', operator: 'after', dateValue: '2026-10-08T00:00:00.000Z' },
			{ field: 'single_select|status', operator: 'equals', optionValue: 'o1' },
			{ field: 'multi_select|tags', operator: 'includes_all', optionValues: ['tag'] },
			{ field: 'boolean|flag', operator: 'is_true', textValue: 'stale' },
		],
		'OR',
	);
	assert.equal(group.operator, 'OR');
	assert.deepEqual(
		group.conditions.map((c) => c.value),
		['John', [2, 10], '2026-10-08', 'o1', ['tag'], undefined],
	);
	assert.deepEqual(
		group.conditions.map((c) => c.fieldId),
		['name', 'amount', 'date', 'status', 'tags', 'flag'],
	);
});
test('invalid operators, stale field types, missing options and ranges fail before query', () => {
	for (const criterion of [
		{ field: 'text|name', operator: 'greater_than', numberValue: 2 },
		{ field: 'text|amount', operator: 'contains', textValue: 'x' },
		{ field: 'single_select|status', operator: 'equals', optionValue: 'gone' },
		{ field: 'currency|amount', operator: 'between', numberValue: 10, numberEnd: 2 },
		{ field: 'date|date', operator: 'between', dateValue: '2026-10-10', dateEnd: '2026-10-01' },
		{ field: 'date|date', operator: 'last_x_days', days: 0 },
	])
		assert.throws(() => buildFilters(fields, [criterion], 'AND'));
});
test('valueless operators omit stale values and relative dates use day counts', () => {
	const result = buildFilters(
		fields,
		[
			{ field: 'date|date', operator: 'today', dateValue: 'bad' },
			{ field: 'date|date', operator: 'last_x_days', days: 30 },
		],
		'AND',
	);
	assert.equal('value' in result.conditions[0], false);
	assert.equal(result.conditions[1].value, 30);
});
test('field, operator and choice dropdowns use schema and the current criterion sibling', async () => {
	const { context } = ctx({ object: 'contact', '&field': 'single_select|status' }, () => ({}));
	const methods = new IngeniumPortal().methods.loadOptions;
	const options = await methods.getFilterOptions.call(context);
	assert.deepEqual(options.map((o) => o.value).sort(), ['o1', 'o2']);
	assert.equal(options.find((o) => o.value === 'o2').name, 'Closed (Inactive)');
	assert.deepEqual(
		(await methods.getFilterOperators.call(context)).map((o) => o.value),
		['equals', 'is_empty'],
	);
	assert.equal(
		(await methods.getFilterFields.call(context)).some((o) => o.value === 'currency|amount'),
		true,
	);
});
test('Get Many applies criteria to each page and respects limit and item links', async () => {
	const { context, calls } = ctx(
		{
			resource: 'record',
			operation: 'getMany',
			object: 'contact',
			filters: { criteria: [{ field: 'text|name', operator: 'contains', textValue: 'x' }] },
			matchCriteria: 'AND',
			returnAll: false,
			limit: 101,
		},
		(o) => ({
			records: Array.from({ length: 100 }, (_, i) => ({ id: `${o.body.query.page}-${i}` })),
			totalCount: 500,
		}),
	);
	const [items] = await new IngeniumPortal().execute.call(context);
	assert.equal(items.length, 101);
	assert.equal(calls.length, 3);
	assert.deepEqual(calls[1].body.query.filters, calls[2].body.query.filters);
	assert.deepEqual(items[100].pairedItem, { item: 0 });
});
test('Get by criteria returns the canonical record and rejects multiple or missing matches', async () => {
	const parameters = {
		resource: 'record',
		operation: 'get',
		matchBy: 'filters',
		object: 'contact',
		filters: { criteria: [{ field: 'text|name', operator: 'equals', textValue: 'unique' }] },
		matchCriteria: 'AND',
	};
	const { context, calls } = ctx(parameters, (o) =>
		o.url.endsWith('/query')
			? { records: [{ id: 'record-id' }], totalCount: 1 }
			: { recordId: 'record-id', values: {} },
	);
	const [items] = await new IngeniumPortal().execute.call(context);
	assert.equal(items[0].json.recordId, 'record-id');
	assert.equal(calls[2].method, 'GET');
	for (const count of [0, 2]) {
		const fixture = ctx(parameters, () => ({
			records: count ? [{ id: 'a' }, { id: 'b' }] : [],
			totalCount: count,
		}));
		await assert.rejects(
			new IngeniumPortal().execute.call(fixture.context),
			count ? /More than one/ : /No unique/,
		);
		assert.equal(fixture.calls.length, 2);
	}
});
test('value editor visibility follows field types and operators, including no-value dates', () => {
	const filter = filterProperties.find((p) => p.name === 'filters');
	const controls = filter.options[0].values;
	const visible = (field, operator) =>
		controls.filter((p) => NodeHelpers.displayParameter({ field, operator }, p)).map((p) => p.name);
	assert.deepEqual(visible('single_select|status', 'equals'), ['field', 'operator', 'optionValue']);
	assert.deepEqual(visible('multi_select|tags', 'includes_all'), [
		'field',
		'operator',
		'optionValues',
	]);
	assert.deepEqual(visible('date|date', 'today'), ['field', 'operator']);
	assert.deepEqual(visible('date|date', 'last_x_days'), ['field', 'operator', 'days']);
	assert.deepEqual(visible('currency|amount', 'between'), [
		'field',
		'operator',
		'numberValue',
		'numberEnd',
	]);
	assert.deepEqual(visible('date|date', 'between'), ['field', 'operator', 'dateValue', 'dateEnd']);
	assert.deepEqual(visible('text|name', 'contains'), ['field', 'operator', 'textValue']);
	const props = new IngeniumPortal().description.properties;
	for (const values of [
		{ resource: 'record', operation: 'getMany', matchBy: 'id' },
		{ resource: 'record', operation: 'get', matchBy: 'filters' },
	])
		assert.equal(
			props.filter((p) => p.name === 'filters' && NodeHelpers.displayParameter(values, p)).length,
			1,
		);
	assert.equal(
		props.filter(
			(p) =>
				p.name === 'recordId' &&
				NodeHelpers.displayParameter(
					{ resource: 'record', operation: 'get', matchBy: 'filters' },
					p,
				),
		).length,
		0,
	);
});

test('schema output can use object keys while keeping array compatibility', async () => {
	for (const format of ['byName', 'array', undefined]) {
		const fixture = ctx({ resource: 'schema', operation: 'get', schemaFormat: format }, () => ({}));
		const [items] = await new IngeniumPortal().execute.call(fixture.context);
		if (format === 'byName') assert.equal(items[0].json.objects.contact.key, 'contact');
		else assert.equal(Array.isArray(items[0].json.objects), true);
	}
	const props = new IngeniumPortal().description.properties.filter(
		(p) => p.name === 'schemaFormat',
	);
	const old = props.find((p) =>
		NodeHelpers.displayParameter({ resource: 'schema' }, p, { typeVersion: 1 }),
	);
	const latest = props.find((p) =>
		NodeHelpers.displayParameter({ resource: 'schema' }, p, { typeVersion: 1.1 }),
	);
	assert.equal(old.default, 'array');
	assert.equal(latest.default, 'byName');
});

test('new criteria wait for a selected field before requesting operators or options', async () => {
	const fixture = ctx({ object: 'contact', '&field': '' }, () => ({}));
	const methods = new IngeniumPortal().methods.loadOptions;
	assert.deepEqual(await methods.getFilterOperators.call(fixture.context), []);
	assert.deepEqual(await methods.getFilterOptions.call(fixture.context), []);
	assert.equal(fixture.calls.length, 0);
	const operator = filterProperties
		.find((p) => p.name === 'filters')
		.options[0].values.find((p) => p.name === 'operator');
	assert.equal(NodeHelpers.displayParameter({ field: '', operator: '' }, operator), false);
});

test('new SMS version sends a To Number with no Record ID and retains the logical key', async () => {
	const fixture = ctx(
		{
			resource: 'sms',
			operation: 'send',
			toNumber: '+353871234567',
			message: 'Test',
			checks: '[]',
			operationKey: 'reminder:test',
		},
		() => ({ outcome: 'accepted' }),
	);
	fixture.context.getNode = () => ({
		name: 'test',
		type: 'ingeniumPortal',
		typeVersion: 1.2,
		parameters: {},
		position: [0, 0],
	});
	await new IngeniumPortal().execute.call(fixture.context);
	assert.deepEqual(fixture.calls[0].body, {
		toNumber: '+353871234567',
		message: 'Test',
		checks: [],
	});
	assert.equal(fixture.calls[0].headers['Idempotency-Key'], 'reminder:test');
	const props = new IngeniumPortal().description.properties;
	const shown = props.filter((p) =>
		NodeHelpers.displayParameter({ resource: 'sms', operation: 'send' }, p, { typeVersion: 1.2 }),
	);
	assert.equal(
		shown.some((p) => p.name === 'recordId'),
		false,
	);
	assert.equal(
		shown.some((p) => p.name === 'toNumber'),
		true,
	);
	assert.equal(
		props
			.filter((p) => p.name === 'recordId')
			.some((p) =>
				NodeHelpers.displayParameter({ resource: 'sms', operation: 'send' }, p, {
					typeVersion: 1.1,
				}),
			),
		true,
	);
});
test('invalid direct numbers are rejected before making an SMS request', async () => {
	const fixture = ctx(
		{
			resource: 'sms',
			operation: 'send',
			toNumber: '0871234567',
			message: 'Test',
			checks: '[]',
			operationKey: 'test',
		},
		() => ({}),
	);
	fixture.context.getNode = () => ({
		name: 'test',
		type: 'ingeniumPortal',
		typeVersion: 1.2,
		parameters: {},
		position: [0, 0],
	});
	await assert.rejects(
		new IngeniumPortal().execute.call(fixture.context),
		/international country code/,
	);
	assert.equal(fixture.calls.length, 0);
});
