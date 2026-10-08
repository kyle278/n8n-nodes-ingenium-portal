import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeProperties,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { jsonObject, pathPart, request, type Schema } from './helpers';
import { buildFilters, filterProperties, filterLoadOptions, type Criterion } from './filters';

const operation = (resource: string, options: [string, string, string][]): INodeProperties => {
	const property: INodeProperties = {
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		default: 'get',
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		options: options.map(([name, value, action]) => ({ name, value, action })),
	};
	property.default = options[0][1];
	return property;
};
const show = (resource: string, operations: string[]) => ({
	show: { resource: [resource], operation: operations },
});
const properties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Operation Receipt', value: 'receipt' },
			{ name: 'Record', value: 'record' },
			{ name: 'Schema', value: 'schema' },
			{ name: 'SMS', value: 'sms' },
			{ name: 'Workflow State', value: 'state' },
		],
		default: 'record',
	},
	operation('record', [
		['Create', 'create', 'Create a record'],
		['Get', 'get', 'Get a record'],
		['Get Many', 'getMany', 'Get many records'],
		['Search', 'search', 'Search records'],
		['Update', 'update', 'Update a record'],
	]),
	operation('schema', [['Get', 'get', 'Get the schema']]),
	{
		displayName: 'Object Output Format',
		name: 'schemaFormat',
		type: 'options',
		default: 'array',
		options: [
			{ name: 'By Object API Name', value: 'byName' },
			{ name: 'Array', value: 'array' },
		],
		description: 'Use object API names as keys instead of numbered array entries',
		displayOptions: { show: { resource: ['schema'], '@version': [1] } },
	},
	{
		displayName: 'Object Output Format',
		name: 'schemaFormat',
		type: 'options',
		default: 'byName',
		options: [
			{ name: 'By Object API Name', value: 'byName' },
			{ name: 'Array', value: 'array' },
		],
		description: 'Use object API names as keys instead of numbered array entries',
		displayOptions: { show: { resource: ['schema'], '@version': [{ _cnd: { gte: 1.1 } }] } },
	},
	operation('sms', [['Send', 'send', 'Send an SMS']]),
	operation('state', [
		['Get', 'get', 'Get workflow state'],
		['Get Many', 'getMany', 'Get many workflow state items'],
		['Set', 'set', 'Set workflow state'],
	]),
	operation('receipt', [['Get', 'get', 'Get an operation receipt']]),
	{
		displayName: 'Object Name or ID',
		name: 'object',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getObjects' },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['record'] } },
		description:
			'Choose from the list, or specify an ID using an expression. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Record ID',
		name: 'recordId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['record'], operation: ['update'] } },
	},
	{
		displayName: 'Record ID',
		name: 'recordId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['record'], operation: ['get'], matchBy: ['id'] } },
	},
	{
		displayName: 'Record ID',
		name: 'recordId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['sms'], operation: ['send'], '@version': [{ _cnd: { lt: 1.2 } }] },
		},
	},
	{
		displayName: 'To Number',
		name: 'toNumber',
		type: 'string',
		required: true,
		default: '',
		placeholder: '+353871234567',
		description:
			'Destination phone number including country code. Map a phone number from a previous step or enter it directly.',
		displayOptions: {
			show: { resource: ['sms'], operation: ['send'], '@version': [{ _cnd: { gte: 1.2 } }] },
		},
	},
	...filterProperties,
	{
		displayName: 'Logical Operation Key',
		name: 'operationKey',
		type: 'string',
		required: true,
		default: '',
		description:
			'Stable change or campaign/record/cycle key. Keep it on retries; never change it to bypass an uncertain SMS.',
		displayOptions: {
			show: {
				resource: ['record', 'sms', 'state'],
				operation: ['create', 'update', 'send', 'set'],
			},
		},
	},
	{
		displayName: 'Expected Model Version',
		name: 'modelVersion',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, numberPrecision: 0 },
		description:
			'Current schema version. Zero omits it for organisations without model publication.',
		displayOptions: show('record', ['create', 'update']),
	},
	{
		displayName: 'Expected Row Version',
		name: 'rowVersion',
		type: 'number',
		required: true,
		default: 1,
		typeOptions: { minValue: 1, numberPrecision: 0 },
		displayOptions: show('record', ['update']),
	},
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'fixedCollection',
		default: {},
		placeholder: 'Add Field',
		typeOptions: { multipleValues: true },
		displayOptions: show('record', ['create', 'update']),
		options: [
			{
				displayName: 'Field',
				name: 'values',
				values: [
					{
						displayName: 'Field Name or ID',
						name: 'fieldId',
						type: 'options',
						default: '',
						typeOptions: { loadOptionsMethod: 'getFields', loadOptionsDependsOn: ['object'] },
						description:
							'Choose from the list, or specify an ID using an expression. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
						required: true,
					},
					{
						displayName: 'Value (JSON)',
						name: 'value',
						type: 'json',
						default: 'null',
						description:
							'JSON string, number, boolean, option/relationship ID array, or null to clear',
					},
				],
			},
		],
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['record', 'state'], operation: ['search', 'getMany'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1, maxValue: 10000, numberPrecision: 0 },
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: ['record', 'state'], operation: ['search', 'getMany'], returnAll: [false] },
		},
	},
	{
		displayName: 'Query (JSON)',
		name: 'query',
		type: 'json',
		default: '{}',
		description: 'Portal filters, search, columns and sorting. This node manages pagination.',
		displayOptions: show('record', ['search']),
	},
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		required: true,
		displayOptions: show('sms', ['send']),
	},
	{
		displayName: 'Eligibility Checks (JSON)',
		name: 'checks',
		type: 'json',
		default: '[]',
		description: 'Optional portal query guards with expect any/none',
		displayOptions: show('sms', ['send']),
	},
	{
		displayName: 'Namespace',
		name: 'namespace',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['state'] } },
	},
	{
		displayName: 'State Key',
		name: 'stateKey',
		type: 'string',
		default: '',
		required: true,
		displayOptions: show('state', ['get', 'set']),
	},
	{
		displayName: 'Expected Version',
		name: 'stateVersion',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, numberPrecision: 0 },
		description: 'Zero creates an absent item; use the current version to update',
		displayOptions: show('state', ['set']),
	},
	{
		displayName: 'Value (JSON)',
		name: 'stateValue',
		type: 'json',
		default: '{}',
		displayOptions: show('state', ['set']),
	},
	{
		displayName: 'Due At',
		name: 'dueAt',
		type: 'string',
		default: '',
		description: 'ISO timestamp with timezone; empty clears the due date',
		displayOptions: show('state', ['set']),
	},
	{
		displayName: 'Due Before',
		name: 'dueBefore',
		type: 'string',
		default: '',
		description: 'Optional ISO timestamp with timezone',
		displayOptions: show('state', ['getMany']),
	},
	{
		displayName: 'Operation ID',
		name: 'operationId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: show('receipt', ['get']),
	},
];
export class IngeniumPortal implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Ingenium Portal',
		name: 'ingeniumPortal',
		icon: { light: 'file:ingeniumPortal.svg', dark: 'file:ingeniumPortal.dark.svg' },
		group: ['input'],
		version: [1, 1.1, 1.2],
		defaultVersion: 1.2,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read and write organisation records, send SMS and manage workflow state',
		defaults: { name: 'Ingenium Portal' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'ingeniumPortalApi', required: true }],
		properties,
		usableAsTool: true,
	};
	methods = {
		loadOptions: {
			...filterLoadOptions,
			async getObjects(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const schema = (await request.call(this, 'GET', '/schema')) as unknown as Schema;
				return schema.objects
					.map((o) => ({ name: o.name, value: o.key }))
					.sort((a, b) => a.name.localeCompare(b.name));
			},
			async getFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const schema = (await request.call(this, 'GET', '/schema')) as unknown as Schema;
				return (
					schema.objects.find((o) => o.key === this.getCurrentNodeParameter('object'))?.fields ?? []
				)
					.filter((f) => f.editable)
					.map((f) => ({ name: `${f.label} (${f.type})`, value: f.id }))
					.sort((a, b) => a.name.localeCompare(b.name));
			},
		},
	};
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const output: INodeExecutionData[] = [];
		for (let i = 0; i < this.getInputData().length; i++) {
			try {
				const p = (name: string) => this.getNodeParameter(name, i);
				const resource = p('resource') as string,
					op = p('operation') as string;
				const emit = (data: IDataObject) => output.push({ json: data, pairedItem: { item: i } });
				if (resource === 'schema') {
					const schema = await request.call(this, 'GET', '/schema');
					if (p('schemaFormat') === 'byName') {
						const objects = schema.objects as unknown as Schema['objects'];
						emit({
							...schema,
							objects: Object.fromEntries(objects.map((object) => [object.key, object])),
						});
					} else emit(schema);
					continue;
				}
				if (resource === 'receipt') {
					emit(
						await request.call(this, 'GET', `/operations/${pathPart(p('operationId') as string)}`),
					);
					continue;
				}
				if (resource === 'sms') {
					const checks =
						typeof p('checks') === 'string'
							? (JSON.parse(p('checks') as string) as unknown)
							: p('checks');
					if (!Array.isArray(checks))
						throw new NodeOperationError(this.getNode(), 'Eligibility Checks must be a JSON array');
					const direct = this.getNode().typeVersion >= 1.2;
					const recipient: IDataObject = direct
						? { toNumber: p('toNumber') }
						: { recordId: p('recordId') };
					if (
						direct &&
						(typeof recipient.toNumber !== 'string' ||
							!/^\+[1-9]\d{7,14}$/.test(recipient.toNumber.replace(/[\s()-]/g, '')))
					)
						throw new NodeOperationError(
							this.getNode(),
							'To Number must include the international country code, for example +353871234567',
						);
					emit(
						await request.call(
							this,
							'POST',
							'/messages/sms',
							{ ...recipient, message: p('message'), checks },
							p('operationKey') as string,
						),
					);
					continue;
				}
				if (resource === 'record') {
					const base = `/objects/${pathPart(p('object') as string)}`;
					if (op === 'search' || op === 'getMany' || (op === 'get' && p('matchBy') === 'filters')) {
						let query: IDataObject;
						if (op === 'search') query = jsonObject(p('query'), 'Query');
						else {
							const schema = (await request.call(this, 'GET', '/schema')) as unknown as Schema;
							const fields = schema.objects.find((o) => o.key === p('object'))?.fields;
							if (!fields)
								throw new NodeOperationError(
									this.getNode(),
									'Object is unavailable. Refresh the schema and select it again.',
								);
							const criteria = (p('filters') as { criteria?: Criterion[] })?.criteria ?? [];
							if (op === 'get' && !criteria.length)
								throw new NodeOperationError(
									this.getNode(),
									'Add at least one criterion to get a record by filters',
								);
							query = {
								filters: buildFilters(fields, criteria, p('matchCriteria')),
							};
						}
						if ('page' in query || 'pageSize' in query)
							throw new NodeOperationError(
								this.getNode(),
								'This node manages pagination; remove page/pageSize from Query',
							);
						const limit = op === 'get' ? 2 : p('returnAll') ? Infinity : (p('limit') as number);
						const singleResults: IDataObject[] = [];
						let count = 0;
						for (let page = 1; ; page++) {
							const result = await request.call(this, 'POST', `${base}/query`, {
								query: { ...query, page, pageSize: 100 },
							});
							const records = result.records as IDataObject[];
							if (op === 'get' && Number(result.totalCount) > 1)
								throw new NodeOperationError(
									this.getNode(),
									'More than one record matches. Add criteria or use Get Many.',
								);
							for (const row of records) {
								if (count >= limit) break;
								if (op === 'get') singleResults.push(row);
								else emit(row);
								count++;
							}
							if (count >= limit || !records.length || page * 100 >= Number(result.totalCount))
								break;
						}
						if (op === 'get') {
							if (singleResults.length !== 1)
								throw new NodeOperationError(
									this.getNode(),
									'No unique record matches these filters',
								);
							const match = singleResults[0];
							emit(
								await request.call(this, 'GET', `${base}/records/${pathPart(match.id as string)}`),
							);
						}
					} else if (op === 'get')
						emit(
							await request.call(
								this,
								'GET',
								`${base}/records/${pathPart(p('recordId') as string)}`,
							),
						);
					else if (op === 'create' || op === 'update') {
						const fields = p('fields') as { values?: { fieldId: string; value: unknown }[] };
						const seen = new Set<string>();
						const values = (fields.values ?? []).map((f) => {
							if (seen.has(f.fieldId))
								throw new NodeOperationError(this.getNode(), 'A field can only be supplied once');
							seen.add(f.fieldId);
							return {
								fieldId: f.fieldId,
								value: typeof f.value === 'string' ? (JSON.parse(f.value) as unknown) : f.value,
							};
						});
						const body: IDataObject = { values };
						if (p('modelVersion')) body.expectedModelVersion = p('modelVersion');
						if (op === 'update') body.expectedRowVersion = p('rowVersion');
						emit(
							await request.call(
								this,
								op === 'create' ? 'POST' : 'PATCH',
								`${base}/records${op === 'update' ? `/${pathPart(p('recordId') as string)}` : ''}`,
								body,
								p('operationKey') as string,
							),
						);
					} else throw new NodeOperationError(this.getNode(), 'Unsupported record operation');
					continue;
				}
				if (resource === 'state') {
					const base = `/state/${pathPart(p('namespace') as string)}`;
					if (op === 'get')
						emit(await request.call(this, 'GET', `${base}/${pathPart(p('stateKey') as string)}`));
					else if (op === 'set') {
						const raw = p('stateValue');
						emit(
							await request.call(
								this,
								'PATCH',
								`${base}/${pathPart(p('stateKey') as string)}`,
								{
									expectedVersion: p('stateVersion'),
									value: (typeof raw === 'string'
										? (JSON.parse(raw) as unknown)
										: raw) as IDataObject[string],
									dueAt: p('dueAt') || null,
								},
								p('operationKey') as string,
							),
						);
					} else if (op === 'getMany') {
						const limit = p('returnAll') ? Infinity : (p('limit') as number);
						let count = 0,
							after: string | undefined;
						const cursors = new Set<string>();
						do {
							const qs: IDataObject = { limit: 100 };
							if (p('dueBefore')) qs.dueBefore = p('dueBefore');
							if (after) qs.after = after;
							const result = await request.call(this, 'GET', base, undefined, undefined, qs);
							for (const row of result.items as IDataObject[]) {
								if (count >= limit) break;
								emit(row);
								count++;
							}
							after = result.nextCursor as string | undefined;
							if (after && cursors.has(after))
								throw new NodeOperationError(this.getNode(), 'Repeated pagination cursor');
							if (after) cursors.add(after);
						} while (after && count < limit);
					} else throw new NodeOperationError(this.getNode(), 'Unsupported state operation');
					continue;
				}
				throw new NodeOperationError(this.getNode(), 'Unsupported resource');
			} catch (error) {
				if (this.continueOnFail()) {
					output.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				if (error instanceof NodeApiError) {
					throw new NodeApiError(
						this.getNode(),
						{ message: error.message },
						{
							message: error.message,
							description: error.description ?? undefined,
							httpCode: error.httpCode ?? undefined,
							itemIndex: i,
						},
					);
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}
		return [output];
	}
}
