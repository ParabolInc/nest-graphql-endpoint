"use strict";
// use this hack until fetch is included in node types
/// <reference lib="dom" />
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const graphql_schema_1 = require("@octokit/graphql-schema");
const graphql_1 = require("graphql");
const nestGraphQLEndpoint_1 = tslib_1.__importDefault(require("./nestGraphQLEndpoint"));
const defaultExecutor = async (document, variables, endpointTimeout, context) => {
    const controller = new AbortController();
    const { signal } = controller;
    const { accessToken, headers } = context;
    const timeout = setTimeout(() => {
        controller.abort();
    }, endpointTimeout);
    try {
        const result = await fetch('https://api.github.com/graphql', {
            signal: signal,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
                ...headers,
            },
            body: JSON.stringify({
                query: (0, graphql_1.print)(document),
                variables,
            }),
        });
        clearTimeout(timeout);
        const resJSON = (await result.json());
        if ('errors' in resJSON || 'data' in resJSON)
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
    const executor = params.executor || defaultExecutor;
    const prefix = params.prefix || '_extGitHub';
    const batchKey = params.batchKey || 'accessToken';
    const endpointTimeout = params.endpointTimeout || 8000;
    const schemaIDL = params.schemaIDL || graphql_schema_1.schema.idl;
    const githubRequest = async (input) => {
        const { query, endpointContext, variables, batchRef, info } = input;
        const { schema } = info;
        const githubApi = schema.getType(`${prefix}Api`);
        const fields = githubApi.getFields();
        const wrapperAST = (0, graphql_1.parse)(query);
        const { definitions } = wrapperAST;
        const [firstDefinition] = definitions;
        const { operation } = firstDefinition;
        const resolve = fields[operation].resolve;
        const source = {
            context: endpointContext,
            wrapper: wrapperAST,
            wrapperVars: variables,
        };
        const context = batchRef ?? {};
        const data = (await resolve(source, {}, context, info));
        const { errors } = source;
        return { data, errors };
    };
    const nestedSchema = (0, nestGraphQLEndpoint_1.default)({
        parentSchema,
        parentType,
        fieldName,
        resolveEndpointContext,
        executor,
        prefix,
        batchKey,
        endpointTimeout,
        schemaIDL,
    });
    return { schema: nestedSchema, githubRequest };
};
exports.default = nestGitHubEndpoint;
//# sourceMappingURL=nestGitHubEndpoint.js.map