"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const graphql_schema_1 = require("@octokit/graphql-schema");
const abort_controller_1 = tslib_1.__importDefault(require("abort-controller"));
const graphql_1 = require("graphql");
const node_fetch_1 = tslib_1.__importDefault(require("node-fetch"));
const nestGraphQLEndpoint_1 = tslib_1.__importDefault(require("./nestGraphQLEndpoint"));
const ENDPOINT_TIMEOUT = 8000;
const executor = async (document, variables, context) => {
    const controller = new abort_controller_1.default();
    const { signal } = controller;
    const { accessToken } = context;
    const timeout = setTimeout(() => {
        controller.abort();
    }, ENDPOINT_TIMEOUT);
    try {
        const result = await node_fetch_1.default('https://api.github.com/graphql', {
            signal,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
            body: JSON.stringify({
                query: graphql_1.print(document),
                variables,
            }),
        });
        clearTimeout(timeout);
        const resJSON = await result.json();
        if (resJSON.data || resJSON.errors)
            return resJSON;
        const message = String(resJSON.message) || JSON.stringify(resJSON);
        return {
            errors: [
                {
                    type: 'GitHub Gateway Error',
                    message,
                },
            ],
            data: null,
        };
    }
    catch (e) {
        clearTimeout(timeout);
        return {
            errors: [
                {
                    type: 'GitHub is down',
                    message: String(e.message),
                },
            ],
            data: null,
        };
    }
};
const nestGitHubEndpoint = (params) => {
    const { parentSchema, parentType, fieldName, resolveEndpointContext } = params;
    const prefix = params.prefix || '_extGitHub';
    const githubRequest = async (wrapper, endpointContext, context, info) => {
        const { schema } = info;
        const githubApi = schema.getType(`${prefix}Api`);
        const fields = githubApi.getFields();
        const wrapperAST = graphql_1.parse(wrapper);
        const { definitions } = wrapperAST;
        const [firstDefinition] = definitions;
        const { operation } = firstDefinition;
        const resolve = fields[operation].resolve;
        const source = { context: endpointContext, wrapper: wrapperAST };
        const data = await resolve(source, {}, context, info);
        const { errors } = source;
        return { data, errors };
    };
    const nestedSchema = nestGraphQLEndpoint_1.default({
        parentSchema,
        parentType,
        fieldName,
        resolveEndpointContext,
        executor,
        prefix: prefix || '_extGitHub',
        batchKey: 'accessToken',
        endpointTimeout: ENDPOINT_TIMEOUT,
        schemaIDL: graphql_schema_1.schema.idl,
    });
    return { schema: nestedSchema, githubRequest };
};
exports.default = nestGitHubEndpoint;
//# sourceMappingURL=nestGitHubEndpoint.js.map