"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pruneTypeDefs = exports.nestGraphQLEndpoints = exports.mergeNestedUsage = exports.getNestedUsage = exports.findMissingNestedField = void 0;
const tslib_1 = require("tslib");
const graphql_1 = require("graphql");
const getNestedUsage_1 = tslib_1.__importStar(require("./getNestedUsage"));
exports.getNestedUsage = getNestedUsage_1.default;
Object.defineProperty(exports, "findMissingNestedField", { enumerable: true, get: function () { return getNestedUsage_1.findMissingNestedField; } });
Object.defineProperty(exports, "mergeNestedUsage", { enumerable: true, get: function () { return getNestedUsage_1.mergeNestedUsage; } });
const getDataLoader_1 = tslib_1.__importDefault(require("./getDataLoader"));
const nestGraphQLEndpoints_1 = tslib_1.__importDefault(require("./nestGraphQLEndpoints"));
exports.nestGraphQLEndpoints = nestGraphQLEndpoints_1.default;
const prefixTypeDefs_1 = tslib_1.__importStar(require("./prefixTypeDefs"));
const pruneTypeDefs_1 = tslib_1.__importDefault(require("./pruneTypeDefs"));
exports.pruneTypeDefs = pruneTypeDefs_1.default;
const transformNestedSelection_1 = tslib_1.__importDefault(require("./transformNestedSelection"));
const nestGraphQLEndpoint = (params) => {
    const { parentType, fieldName, resolveEndpointContext, executor, schemaIDL, prefix, batchKey = 'accessToken', endpointTimeout = 10000, } = params;
    const getTypeDefs = (usage) => {
        const document = (0, graphql_1.parse)(schemaIDL, { noLocation: true });
        const nestableDocument = {
            ...document,
            definitions: document.definitions.filter(prefixTypeDefs_1.isNestableDefinition),
        };
        if (!usage)
            return (0, prefixTypeDefs_1.default)(nestableDocument, prefix);
        // the Api type returns both root types
        const endpointUsage = { Query: [], Mutation: [] };
        Object.entries(usage).forEach(([typeName, fieldNames]) => {
            if (typeName.startsWith(prefix))
                endpointUsage[typeName.slice(prefix.length)] = fieldNames;
        });
        return (0, prefixTypeDefs_1.default)((0, pruneTypeDefs_1.default)(nestableDocument, endpointUsage), prefix);
    };
    // only needed to transform a nested request, so the first one builds it
    let endpointSchema;
    const getEndpointSchema = () => {
        endpointSchema ??= (0, graphql_1.buildSchema)(schemaIDL, { assumeValidSDL: true });
        return endpointSchema;
    };
    const resolveOperation = (isMutation) => async (source, _args, executionRef, info) => {
        if (source.errors)
            return null;
        const { context, wrapper, wrapperVars } = source;
        const { dataLoaderOptions } = context;
        let transform;
        try {
            const operationType = isMutation ? 'mutation' : 'query';
            transform = (0, transformNestedSelection_1.default)(getEndpointSchema(), info, prefix, operationType, wrapper);
        }
        catch (e) {
            const errors = [{ message: e.message || 'Transform error' }];
            if (source.resolveErrors) {
                source.resolveErrors(errors);
            }
            else {
                source.errors = errors;
            }
            return null;
        }
        const { document, variables, wrappedPath } = transform;
        // Create a new dataloader for each execution (a context is created for each execution)
        const ghDataLoader = (0, getDataLoader_1.default)(executionRef, dataLoaderOptions);
        const res = await ghDataLoader.load({
            document,
            variables: { ...variables, ...wrapperVars },
            context,
            options: {
                batchKey,
                endpointTimeout,
                executor,
                prefix,
                isMutation: !!isMutation,
            },
        });
        if (source.resolveErrors) {
            source.resolveErrors(res.errors);
        }
        else {
            source.errors = res.errors;
        }
        return wrappedPath
            ? wrappedPath.reduce((obj, prop) => obj?.[prop] ?? null, res.data)
            : res.data;
    };
    const parentTypeDefs = `
      type ${prefix}ErrorLocation {
        line: Int!
        column: Int!
      }
      type ${prefix}Error {
        message: String!
        locations: [${prefix}ErrorLocation!]
        path: [String!]
      }
      type ${prefix}Api {
        errors: [${prefix}Error!]
        query: ${prefix}Query
        mutation: ${prefix}Mutation
      }
      extend type ${parentType} {
        ${fieldName}: ${prefix}Api
      }`;
    const resolvers = {
        [parentType]: {
            [fieldName]: async (source, args, context, info) => {
                const { fieldNodes } = info;
                const [fieldNode] = fieldNodes;
                const { selectionSet } = fieldNode;
                const { selections } = selectionSet;
                const queryField = selections.find((selection) => selection.kind === graphql_1.Kind.FIELD && selection.name.value === 'query');
                const mutationField = selections.find((selection) => selection.kind === graphql_1.Kind.FIELD && selection.name.value === 'mutation');
                if (queryField && mutationField) {
                    return {
                        errors: [
                            {
                                message: 'Request can only include query or mutation',
                            },
                        ],
                    };
                }
                if (!queryField && !mutationField) {
                    return {
                        errors: [
                            {
                                message: 'No query or mutation operation provided',
                            },
                        ],
                    };
                }
                let endpointContext;
                try {
                    endpointContext = await resolveEndpointContext(source, args, context, info);
                }
                catch (e) {
                    return {
                        errors: [
                            {
                                message: e.message || 'No endpoint context provided',
                            },
                        ],
                    };
                }
                return { context: endpointContext };
            },
        },
        [`${prefix}Api`]: {
            errors: (source) => {
                // If an error was triggered before fetch, abort early
                if (source.errors)
                    return source.errors;
                // If a fetch is already in flight, re-use the same promise
                if (source.errorPromise)
                    return source.errorPromise;
                // If the endpoint returns errors, populate the errors field
                source.errorPromise = new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        resolve([{ message: `${prefix}: Resolution Timeout` }]);
                    }, endpointTimeout + 30);
                    source.resolveErrors = (errors) => {
                        clearTimeout(timeout);
                        resolve(errors);
                    };
                });
                return source.errorPromise;
            },
            query: resolveOperation(),
            mutation: resolveOperation(true),
        },
    };
    const request = async (input) => {
        const { query, endpointContext, variables, batchRef, info } = input;
        const api = info.schema.getType(`${prefix}Api`);
        const wrapper = (0, graphql_1.parse)(query);
        const { operation } = wrapper.definitions[0];
        const rootOperation = api.getFields()[operation];
        if (!rootOperation)
            throw new Error(`Unsupported operation: ${operation}`);
        const source = {
            context: endpointContext,
            wrapper,
            wrapperVars: variables,
        };
        const data = (await rootOperation.resolve(source, {}, batchRef ?? {}, info));
        return { data, errors: source.errors };
    };
    return { prefix, getTypeDefs, getEndpointSchema, parentTypeDefs, resolvers, request };
};
tslib_1.__exportStar(require("./types"), exports);
exports.default = nestGraphQLEndpoint;
//# sourceMappingURL=nestGraphQLEndpoint.js.map