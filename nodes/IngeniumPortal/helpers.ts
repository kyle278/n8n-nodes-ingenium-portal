import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
export type SchemaField = {
	id: string;
	label: string;
	type: string;
	editable: boolean;
	resultType?: string;
	filterable?: boolean;
	filterValueType?: string;
	filterOperators?: string[];
	options?: { id: string; label: string; value: string; active: boolean }[];
};
export type Schema = {
	objects: {
		key: string;
		name: string;
		fields: SchemaField[];
	}[];
};
export function portalOrigin(value: string): string {
	const url = new URL(value);
	if (
		url.protocol !== 'https:' ||
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		!['', '/'].includes(url.pathname)
	)
		throw new Error('Portal URL must be an HTTPS origin without credentials, query or path');
	return url.origin;
}
export function jsonObject(value: unknown, label: string): IDataObject {
	const result = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
	if (!result || typeof result !== 'object' || Array.isArray(result))
		throw new Error(`${label} must be a JSON object`);
	return result as IDataObject;
}
export function pathPart(value: string): string {
	if (!value || value === '.' || value === '..')
		throw new Error('A non-empty resource identifier is required');
	return encodeURIComponent(value);
}
export async function request(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	key?: string,
	qs?: IDataObject,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('ingeniumPortalApi');
	let origin: string;
	try {
		origin = portalOrigin(credentials.portalUrl as string);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error);
	}
	if (key !== undefined && (!key.trim() || key.length > 200))
		throw new NodeOperationError(
			this.getNode(),
			'Logical Operation Key must contain 1–200 characters',
		);
	try {
		return (await this.helpers.httpRequestWithAuthentication.call(this, 'ingeniumPortalApi', {
			method,
			url: `${origin}/api/public/v1${path}`,
			body,
			qs,
			json: true,
			headers: key === undefined ? {} : { 'Idempotency-Key': key },
			timeout: 60000,
			disableFollowRedirect: true,
		})) as IDataObject;
	} catch (error) {
		// Transport errors can include credentials: only expose public envelope fields.
		const failure = error as {
			statusCode?: number;
			response?: { status?: number; data?: unknown; body?: unknown };
			error?: unknown;
		};
		let data: IDataObject = {};
		try {
			data = jsonObject(
				failure.response?.data ?? failure.response?.body ?? failure.error,
				'API error',
			);
		} catch {
			/* No public envelope. */
		}
		const status = failure.statusCode ?? failure.response?.status;
		const message =
			typeof data.error === 'string'
				? data.error
				: 'Portal request failed. Inspect writes and SMS before retrying with the same logical key.';
		throw new NodeApiError(
			this.getNode(),
			{ message },
			{
				message,
				httpCode: status === undefined ? undefined : String(status),
				description: [
					data.code,
					data.requestId && `Request: ${data.requestId}`,
					data.operationId && `Operation: ${data.operationId}`,
				]
					.filter(Boolean)
					.join(' · '),
			},
		);
	}
}
