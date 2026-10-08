const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '../examples/cloud');
fs.mkdirSync(dir, { recursive: true });
const node = (name, type, parameters, x, typeVersion = 1) => ({
	id: name,
	name,
	type: `n8n-nodes-base.${type}`,
	typeVersion,
	position: [x, 680],
	parameters,
});
const code = (name, jsCode, x) => node(name, 'code', { jsCode }, x, 2);
const config = (values) =>
	node(
		'Organisation configuration',
		'set',
		{
			assignments: {
				assignments: Object.entries(values).map(([name, value]) => ({
					id: name,
					name,
					value,
					type:
						typeof value === 'boolean'
							? 'boolean'
							: typeof value === 'number'
								? 'number'
								: 'string',
				})),
			},
			options: {},
		},
		800,
		3.4,
	);
const http = (name, method, endpoint, body, x, extra = {}) => ({
	...node(
		name,
		'httpRequest',
		{
			method,
			url: `={{ $('Validate configuration').first().json.portalOrigin + '/api/public/v1' + ${endpoint} }}`,
			authentication: 'genericCredentialType',
			genericAuthType: 'httpHeaderAuth',
			...(body ? { sendBody: true, specifyBody: 'json', jsonBody: body } : {}),
			options: {
				timeout: 60000,
				redirect: { redirect: { followRedirects: false } },
				response: { response: { responseFormat: 'json' } },
				...extra,
			},
		},
		x,
		4.2,
	),
	retryOnFail: false,
});
const validate = code(
	'Validate configuration',
	`const c=$input.first().json;
const u=new URL(c.portalOrigin);
if(u.protocol!=='https:'||u.origin!==c.portalOrigin||u.username||u.password) throw new Error('Set portalOrigin to the exact HTTPS portal origin, without a trailing slash.');
return [{json:c}];`,
	1020,
);
function write(file, title, description, values, tail) {
	const nodes = [
		node('Start manually', 'manualTrigger', {}, 580),
		config({ portalOrigin: 'https://portal.ingeniumconsulting.net', ...values }),
		validate,
		...tail,
	];
	const connections = {};
	for (let i = 0; i < nodes.length - 1; i++)
		connections[nodes[i].name] = { main: [[{ node: nodes[i + 1].name, type: 'main', index: 0 }]] };
	const overview = `${title}\n\n${description}\n\n### How it works\nRun this workflow manually after setting the configuration fields. Built-in HTTP Request nodes call the organisation-scoped portal API using your selected Header Auth credential. The portal resolves the organisation from that key and checks member access, licences and allowed objects. Another organisation requires its own credential and field mappings. This export contains no keys, patient data or instance identifiers. It does not activate a schedule.\n\n### Setup\nCreate a portal integration through Settings, Connectors, Integration API. In n8n create a Header Auth credential with Name Authorization and Value Bearer followed by the integration key. Select it in every HTTP Request node. Replace configuration placeholders using this organisation's schema. Run the connection check first. Review results against a permitted test record before production use. Keep redirects and automatic request retries disabled.\n\n### Customization\nCopy the workflow per organisation, change its credential and mappings, and review permissions. Preserve logical operation keys when retrying writes. Campaign eligibility, message wording, scheduling and backlog decisions must be configured before adding production sends.`;
	nodes.unshift(
		node(
			'Workflow overview',
			'stickyNote',
			{ content: overview, width: 580, height: 610, color: 1 },
			0,
		),
	);
	nodes[0].position = [0, 0];
	nodes.push({
		...node(
			'Configuration section',
			'stickyNote',
			{
				content:
					'Configure the organisation and validate the portal origin before calling the API.',
				width: 700,
				height: 190,
				color: 7,
			},
			580,
		),
		position: [580, 450],
	});
	nodes.push({
		...node(
			'API section',
			'stickyNote',
			{
				content:
					'Select the same organisation Header Auth credential in all HTTP nodes. Inspect the result before extending this workflow.',
				width: 1000,
				height: 190,
				color: 7,
			},
			1260,
		),
		position: [1260, 450],
	});
	fs.writeFileSync(
		path.join(dir, file),
		JSON.stringify(
			{
				name: title,
				active: false,
				nodes,
				connections,
				settings: {
					executionOrder: 'v1',
					timezone: 'Europe/Dublin',
					saveDataSuccessExecution: 'none',
					saveDataErrorExecution: 'none',
					saveManualExecutions: false,
				},
			},
			null,
			2,
		) + '\n',
	);
}
write(
	'01-check-connection.json',
	'Check an Ingenium Portal connection with HTTP Request',
	'Use this connection check to inspect the schema visible to one organisation integration. It reads metadata only and sends no messages.',
	{},
	[
		http('Read allowed schema', 'GET', "'/schema'", null, 1260),
		code(
			'Summarise available mappings',
			`const s=$input.first().json; if(!Array.isArray(s.objects)) throw new Error('Unexpected schema response'); return [{json:{organisationId:s.organisationId,schemaVersion:s.schemaVersion,objects:s.objects.map(o=>({key:o.key,name:o.name,fields:o.fields.map(f=>({id:f.id,apiName:f.apiName,label:f.label,type:f.type,editable:f.editable,options:f.options}))}))}}];`,
			1480,
		),
	],
);
write(
	'02-preview-audience.json',
	'Preview an Ingenium Portal audience with HTTP Request',
	'Use this bounded audience preview to check typed filters and pagination before building a campaign. The summary reports whether the audience exceeds the configured page cap.',
	{ objectApiName: 'REPLACE_WITH_ALLOWED_OBJECT', queryJson: '{}', maxPages: 10 },
	[
		code(
			'Validate audience query',
			`const c=$input.first().json; if(!/^[a-z][a-z0-9_]*$/.test(c.objectApiName)) throw new Error('Select an object API name from schema');const query=JSON.parse(c.queryJson);if(!query||Array.isArray(query)||typeof query!=='object')throw new Error('queryJson must be an object');if(!Number.isInteger(c.maxPages)||c.maxPages<1||c.maxPages>100)throw new Error('maxPages must be 1–100');return [{json:{...c,query}}];`,
			1260,
		),
		http(
			'Read bounded audience pages',
			'POST',
			"'/objects/' + encodeURIComponent($('Validate audience query').first().json.objectApiName) + '/query'",
			"={{ {query: {...$('Validate audience query').first().json.query, page:1,pageSize:100}} }}",
			1480,
			{
				pagination: {
					pagination: {
						paginationMode: 'updateAParameterInEachRequest',
						parameters: {
							parameters: [
								{
									type: 'body',
									name: 'query',
									value:
										"={{ {...$('Validate audience query').first().json.query, page:$pageCount + 1,pageSize:100} }}",
								},
							],
						},
						paginationCompleteWhen: 'other',
						completeExpression:
							'={{ $response.body.records.length === 0 || $response.body.page * $response.body.pageSize >= $response.body.totalCount }}',
						limitPagesFetched: true,
						maxRequests: "={{ $('Validate audience query').first().json.maxPages }}",
						requestInterval: 600,
					},
				},
			},
		),
		code(
			'Summarise audience coverage',
			`const pages=$input.all().map(i=>i.json);if(pages.some(p=>!Array.isArray(p.records)))throw new Error('Unexpected query response');const records=pages.flatMap(p=>p.records);const unique=[...new Set(records.map(r=>r.id))];const last=pages.at(-1);const truncated=Boolean(last&&last.page*last.pageSize<last.totalCount&&last.records.length);return [{json:{observedTotalCount:last?.totalCount??0,scannedRecords:records.length,uniqueRecords:unique.length,pages:pages.length,truncated,recordIds:unique,note:truncated?'Page cap reached; this is not the full audience. Increase the cap or narrow filters.':'Offset paging is not a snapshot. Recheck eligibility at dispatch.'}}];`,
			1700,
		),
	],
);
write(
	'03-test-workflow-state.json',
	'Test Ingenium Portal workflow state with HTTP Request',
	'Use this probe to verify optimistic state writes and replay behaviour without changing client records or sending SMS. It writes one labelled integration-owned test state item.',
	{ probeKey: 'setup-check-v1', operationKey: 'setup-state-v1' },
	[
		code(
			'Validate probe identity',
			`const c=$input.first().json;if(!/^[a-zA-Z0-9_-]{1,80}$/.test(c.probeKey)||!/^setup-state-[a-zA-Z0-9_-]+$/.test(c.operationKey))throw new Error('Use a stable probe identity and setup-state- operation key');return [{json:c}];`,
			1260,
		),
		{
			...http(
				'Write setup state',
				'PATCH',
				"'/state/setup/' + encodeURIComponent($('Validate probe identity').first().json.probeKey)",
				"={{ {expectedVersion:0,value:{purpose:'n8n setup probe',version:1}} }}",
				1480,
			),
			parameters: {
				...http(
					'',
					'PATCH',
					"'/state/setup/' + encodeURIComponent($('Validate probe identity').first().json.probeKey)",
					"={{ {expectedVersion:0,value:{purpose:'n8n setup probe',version:1}} }}",
					1480,
				).parameters,
				sendHeaders: true,
				headerParameters: {
					parameters: [
						{
							name: 'Idempotency-Key',
							value: "={{ $('Validate probe identity').first().json.operationKey }}",
						},
					],
				},
			},
		},
		http(
			'Read setup state',
			'GET',
			"'/state/setup/' + encodeURIComponent($('Validate probe identity').first().json.probeKey)",
			null,
			1700,
		),
	],
);
write(
	'04-test-single-sms.json',
	'Test one Ingenium Portal SMS with HTTP Request',
	'Use this manual test only with an explicitly approved test client and message. The guard blocks sending by default. It makes one request with a stable logical key and stops on every uncertain outcome.',
	{
		testRecordId: 'REPLACE_WITH_APPROVED_TEST_RECORD',
		message: 'REPLACE_WITH_APPROVED_TEST_MESSAGE',
		operationKey: 'setup-sms-v1',
		sendApprovedTest: false,
	},
	[
		code(
			'Require an approved SMS test',
			`const c=$input.first().json;if(c.sendApprovedTest!==true)throw new Error('SMS disabled. Configure an approved test recipient and message, then set sendApprovedTest true.');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.testRecordId)||!c.message||c.message.startsWith('REPLACE_'))throw new Error('Configure the approved test record and message');if(!/^setup-sms-[a-zA-Z0-9_-]+$/.test(c.operationKey))throw new Error('Set a stable setup-sms- operation key');return [{json:c}];`,
			1260,
		),
		{
			...http(
				'Send one approved test SMS',
				'POST',
				"'/messages/sms'",
				"={{ {recordId:$('Require an approved SMS test').first().json.testRecordId,message:$('Require an approved SMS test').first().json.message} }}",
				1480,
			),
			parameters: {
				...http(
					'',
					'POST',
					"'/messages/sms'",
					"={{ {recordId:$('Require an approved SMS test').first().json.testRecordId,message:$('Require an approved SMS test').first().json.message} }}",
					1480,
				).parameters,
				sendHeaders: true,
				headerParameters: {
					parameters: [
						{
							name: 'Idempotency-Key',
							value: "={{ $('Require an approved SMS test').first().json.operationKey }}",
						},
					],
				},
			},
		},
		code(
			'Inspect SMS outcome',
			`const receipt=$input.first().json;if(receipt.outcome!=='accepted')throw new Error('SMS was not accepted. Inspect the portal operation history before retrying; keep the same logical key.');return [{json:receipt}];`,
			1700,
		),
	],
);
