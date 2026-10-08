import type {
	Icon,
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';
export class IngeniumPortalApi implements ICredentialType {
	name = 'ingeniumPortalApi';
	icon: Icon = {
		light: 'file:../nodes/IngeniumPortal/ingeniumPortal.svg',
		dark: 'file:../nodes/IngeniumPortal/ingeniumPortal.dark.svg',
	};
	displayName = 'Ingenium Portal API';
	documentationUrl = 'https://github.com/kyle278/n8n-nodes-ingenium-portal#credentials';
	properties: INodeProperties[] = [
		{
			displayName: 'Portal URL',
			name: 'portalUrl',
			type: 'string',
			default: 'https://portal.ingeniumconsulting.net',
			required: true,
			description: 'HTTPS portal origin, without an API path',
		},
		{
			displayName: 'Integration Key',
			name: 'apiKey',
			type: 'string',
			default: '',
			required: true,
			typeOptions: { password: true },
			description:
				'Organisation integration key. Include schema.read for dropdowns and connection testing.',
		},
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } },
	};
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.portalUrl.replace(/[/]$/, "")}}/api/public/v1',
			url: '/schema',
			method: 'GET',
		},
	};
}
