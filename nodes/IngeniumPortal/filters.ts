import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeProperties,
	INodePropertyOptions,
} from 'n8n-workflow';
import { request, type Schema, type SchemaField } from './helpers';

const valueless = [
	'is_empty',
	'is_not_empty',
	'is_true',
	'is_false',
	'today',
	'yesterday',
	'this_week',
	'this_month',
];
const relative = ['last_x_days', 'next_x_days'];
const numberTypes = ['number', 'currency', 'percent'];
const dateTypes = ['date', 'datetime'];
const choiceTypes = ['single_select', 'multi_select', 'user'];
export const effectiveType = (field: SchemaField) =>
	field.filterValueType ?? field.resultType ?? field.type;
export const fieldToken = (field: SchemaField) => `${effectiveType(field)}|${field.id}`;
export function selectedField(fields: SchemaField[], token: unknown): SchemaField {
	const field = fields.find((f) => fieldToken(f) === token);
	if (!field?.filterable || !field.filterOperators?.length)
		throw new Error(
			'Filter field is unavailable or its type changed. Refresh the fields and select it again.',
		);
	return field;
}
const nonempty = { hide: { operator: [...valueless, ''] } };
const types = (names: string[]) => [{ _cnd: { regex: `^(${names.join('|')})\\|` } }];
const valueProperties: INodeProperties[] = [
	{
		displayName: 'Value',
		name: 'textValue',
		type: 'string',
		default: '',
		displayOptions: {
			...nonempty,
			hide: { ...nonempty.hide, field: types([...numberTypes, ...dateTypes, ...choiceTypes]) },
		},
		description: 'Text to match, or a related record ID for a lookup field',
	},
	{
		displayName: 'Value',
		name: 'numberValue',
		type: 'number',
		default: 0,
		displayOptions: { ...nonempty, show: { field: types(numberTypes) } },
	},
	{
		displayName: 'Upper Value',
		name: 'numberEnd',
		type: 'number',
		default: 0,
		displayOptions: { show: { field: types(numberTypes), operator: ['between'] } },
	},
	{
		displayName: 'Value',
		name: 'dateValue',
		type: 'dateTime',
		default: '',
		typeOptions: { dateOnly: true },
		displayOptions: {
			show: { field: types(['date']) },
			hide: { operator: [...valueless, ...relative, ''] },
		},
	},
	{
		displayName: 'Value',
		name: 'dateValue',
		type: 'dateTime',
		default: '',
		displayOptions: {
			show: { field: types(['datetime']) },
			hide: { operator: [...valueless, ...relative, ''] },
		},
	},
	{
		displayName: 'End Date',
		name: 'dateEnd',
		type: 'dateTime',
		default: '',
		typeOptions: { dateOnly: true },
		displayOptions: { show: { field: types(['date']), operator: ['between'] } },
	},
	{
		displayName: 'End Date',
		name: 'dateEnd',
		type: 'dateTime',
		default: '',
		displayOptions: { show: { field: types(['datetime']), operator: ['between'] } },
	},
	{
		displayName: 'Number of Days',
		name: 'days',
		type: 'number',
		default: 7,
		typeOptions: { minValue: 1, maxValue: 36500, numberPrecision: 0 },
		displayOptions: { show: { field: types(dateTypes), operator: relative } },
	},
	{
		displayName: 'Option Name or ID',
		name: 'optionValue',
		type: 'options',
		default: '',
		typeOptions: {
			loadOptionsMethod: 'getFilterOptions',
			loadOptionsDependsOn: ['object', '&field'],
		},
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: { ...nonempty, show: { field: types(['single_select', 'user']) } },
	},
	{
		displayName: 'Option Names or IDs',
		name: 'optionValues',
		type: 'multiOptions',
		default: [],
		typeOptions: {
			loadOptionsMethod: 'getFilterOptions',
			loadOptionsDependsOn: ['object', '&field'],
		},
		description:
			'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: {
			show: { field: types(['multi_select']), operator: ['includes_any', 'includes_all'] },
		},
	},
];

const filterDefinitions: INodeProperties[] = [
	{
		displayName: 'Match By',
		name: 'matchBy',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Record ID', value: 'id' },
			{ name: 'Filters', value: 'filters' },
		],
		default: 'id',
		displayOptions: { show: { resource: ['record'], operation: ['get'] } },
		description:
			'Get by filters requires exactly one matching record. Use Get Many for multiple matches.',
	},
	{
		displayName: 'Match Criteria',
		name: 'matchCriteria',
		type: 'options',
		noDataExpression: true,
		default: 'AND',
		options: [
			{ name: 'All Criteria', value: 'AND' },
			{ name: 'Any Criteria', value: 'OR' },
		],
		displayOptions: {
			show: { resource: ['record'], operation: ['getMany', 'get'] },
			hide: { matchBy: ['id'], operation: ['get'] },
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'fixedCollection',
		default: {},
		placeholder: 'Add Criterion',
		typeOptions: { multipleValues: true },
		options: [
			{
				displayName: 'Criterion',
				name: 'criteria',
				values: [
					{
						displayName: 'Field Name or ID',
						name: 'field',
						type: 'options',
						default: '',
						required: true,
						typeOptions: { loadOptionsMethod: 'getFilterFields', loadOptionsDependsOn: ['object'] },
						description:
							'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
					},
					{
						displayName: 'Operator Name or ID',
						name: 'operator',
						type: 'options',
						default: '',
						required: true,
						typeOptions: {
							loadOptionsMethod: 'getFilterOperators',
							loadOptionsDependsOn: ['object', '&field'],
						},
						description:
							'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
					},
					...valueProperties,
				],
			},
		],
	},
];

export const filterProperties: INodeProperties[] = [
	filterDefinitions[0],
	...filterDefinitions.slice(1).flatMap((property) => [
		{ ...property, displayOptions: { show: { resource: ['record'], operation: ['getMany'] } } },
		{
			...property,
			displayOptions: { show: { resource: ['record'], operation: ['get'], matchBy: ['filters'] } },
		},
	]),
];

async function objectFields(context: ILoadOptionsFunctions): Promise<SchemaField[]> {
	const schema = (await request.call(context, 'GET', '/schema')) as unknown as Schema;
	const object = schema.objects.find((o) => o.key === context.getCurrentNodeParameter('object'));
	if (!object) throw new Error('Select an available object first');
	return object.fields;
}
async function currentField(context: ILoadOptionsFunctions) {
	return selectedField(await objectFields(context), context.getCurrentNodeParameter('&field'));
}
export const filterLoadOptions = {
	async getFilterFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return (await objectFields(this))
			.filter((f) => f.filterable && f.filterOperators?.length)
			.map((f) => ({ name: `${f.label} (${effectiveType(f)})`, value: fieldToken(f) }))
			.sort((a, b) => a.name.localeCompare(b.name));
	},
	async getFilterOperators(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const field = await currentField(this);
		return field.filterOperators!.map((value) => ({
			name: value
				.split('_')
				.map((s) => s[0].toUpperCase() + s.slice(1))
				.join(' '),
			value,
		}));
	},
	async getFilterOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		return ((await currentField(this)).options ?? [])
			.map((o) => ({ name: `${o.label}${o.active ? '' : ' (Inactive)'}`, value: o.id }))
			.sort((a, b) => a.name.localeCompare(b.name));
	},
};

export type Criterion = {
	field: string;
	operator: string;
	textValue?: string;
	numberValue?: number;
	numberEnd?: number;
	dateValue?: string;
	dateEnd?: string;
	days?: number;
	optionValue?: string;
	optionValues?: string[];
};
export function buildFilters(
	fields: SchemaField[],
	criteria: Criterion[],
	combinator: unknown,
): IDataObject {
	if (!['AND', 'OR'].includes(String(combinator)))
		throw new Error('Choose All Criteria or Any Criteria');
	if (criteria.length > 50) throw new Error('At most 50 filter criteria are supported');
	return {
		id: 'n8n-filters',
		operator: combinator as string,
		conditions: criteria.map((row, index) => {
			const field = selectedField(fields, row.field),
				type = effectiveType(field);
			if (!field.filterOperators!.includes(row.operator))
				throw new Error(`Choose a valid operator for ${field.label}`);
			const condition: IDataObject = {
				id: `n8n-${index}`,
				fieldId: field.id,
				operator: row.operator,
			};
			if (valueless.includes(row.operator)) return condition;
			let value: IDataObject[string];
			if (relative.includes(row.operator)) {
				if (!Number.isInteger(row.days) || row.days! < 1 || row.days! > 36500)
					throw new Error('Number of days must be between 1 and 36500');
				value = row.days;
			} else if (numberTypes.includes(type)) {
				const numbers =
					row.operator === 'between' ? [row.numberValue, row.numberEnd] : [row.numberValue];
				if (numbers.some((n) => typeof n !== 'number' || !Number.isFinite(n)))
					throw new Error(`Enter a number for ${field.label}`);
				if (numbers.length === 2 && numbers[0]! > numbers[1]!)
					throw new Error('Lower value must not exceed upper value');
				value = row.operator === 'between' ? (numbers as number[]) : row.numberValue;
			} else if (dateTypes.includes(type)) {
				const dates = (
					row.operator === 'between' ? [row.dateValue, row.dateEnd] : [row.dateValue]
				).map((d) => {
					if (!d || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(d) || !Number.isFinite(Date.parse(d)))
						throw new Error(`Enter a valid date for ${field.label}`);
					return type === 'date' ? d.slice(0, 10) : d;
				});
				if (dates.length === 2 && Date.parse(dates[0]) > Date.parse(dates[1]))
					throw new Error('Start date must not be after end date');
				value = row.operator === 'between' ? dates : dates[0];
			} else if (choiceTypes.includes(type)) {
				const choices =
					type === 'multi_select' ? (row.optionValues ?? []) : [row.optionValue ?? ''];
				if (!choices.length || choices.some((id) => !field.options?.some((o) => o.id === id)))
					throw new Error(`Choose an available option for ${field.label}`);
				value = type === 'multi_select' ? choices : choices[0];
			} else {
				if (typeof row.textValue !== 'string') throw new Error(`Enter a value for ${field.label}`);
				value = row.textValue;
			}
			return { ...condition, value };
		}),
	};
}
