"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const merge_1 = require("@graphql-tools/merge");
const schema_1 = require("@graphql-tools/schema");
const wrap_1 = require("@graphql-tools/wrap");
const getDataLoader_1 = tslib_1.__importDefault(require("./getDataLoader"));
const transformNestedSelection_1 = tslib_1.__importDefault(require("./transformNestedSelection"));
const nestGraphQLEndpoint = (params) => {
    const { parentSchema, parentType, fieldName, resolveEndpointContext, executor, schemaIDL, prefix, batchKey = 'accessToken', endpointTimeout = 10000, } = params;
    const prefixEndpoint = (name) => `${prefix}${name}`;
    const transformedEndpointSchema = wrap_1.wrapSchema({
        schema: schema_1.makeExecutableSchema({
            typeDefs: schemaIDL,
        }),
        createProxyingResolver: () => (parent, _args, _context, info) => parent[info.fieldName],
        transforms: [new wrap_1.RenameRootTypes(prefixEndpoint), new wrap_1.RenameTypes(prefixEndpoint)],
    });
    const resolveOperation = (isMutation) => async (source, _args, executionRef, info) => {
        if (source.errors)
            return null;
        const { context, wrapper, wrapperVars } = source;
        let transform;
        try {
            transform = transformNestedSelection_1.default(info, prefix, wrapper);
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
        const ghDataLoader = getDataLoader_1.default(executionRef);
        const res = await ghDataLoader.load({
            document,
            variables: { ...variables, ...wrapperVars },
            context,
            options: {
                batchKey,
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
    return merge_1.mergeSchemas({
        schemas: [transformedEndpointSchema, parentSchema],
        typeDefs: `
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
      }`,
        resolvers: {
            [parentType]: {
                [fieldName]: async (source, args, context, info) => {
                    const { fieldNodes } = info;
                    const [fieldNode] = fieldNodes;
                    const { selectionSet } = fieldNode;
                    const { selections } = selectionSet;
                    const queryField = selections.find((selection) => selection.kind === 'Field' && selection.name.value === 'query');
                    const mutationField = selections.find((selection) => selection.kind === 'Field' && selection.name.value === 'mutation');
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
                                    message: e?.message || 'No endpoint context provided',
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
        },
    });
};
exports.default = nestGraphQLEndpoint;
//# sourceMappingURL=nestGraphQLEndpoint.js.map