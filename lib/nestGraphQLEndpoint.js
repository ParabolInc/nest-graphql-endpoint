"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const schema_1 = require("@graphql-tools/schema");
const wrap_1 = require("@graphql-tools/wrap");
const graphql_1 = require("graphql");
const getDataLoader_1 = tslib_1.__importDefault(require("./getDataLoader"));
const transformNestedSelection_1 = tslib_1.__importDefault(require("./transformNestedSelection"));
// if a field is aliased in the request that alias will be the key in the `source` object
const externalResolver = (source, _args, _context, info) => {
    const key = info.fieldNodes[0].alias?.value ?? info.fieldName;
    return source[key];
};
const nestGraphQLEndpoint = (params) => {
    const { parentSchema, parentType, fieldName, resolveEndpointContext, executor, schemaIDL, prefix, batchKey = 'accessToken', endpointTimeout = 10000, } = params;
    const prefixEndpoint = (name) => `${prefix}${name}`;
    const schema = (0, schema_1.makeExecutableSchema)({
        typeDefs: schemaIDL,
    });
    const transformedEndpointSchema = (0, wrap_1.wrapSchema)({
        schema,
        transforms: [new wrap_1.RenameRootTypes(prefixEndpoint), new wrap_1.RenameTypes(prefixEndpoint)],
    });
    // overwrite the resolves that wrapSchema added
    const typeMap = transformedEndpointSchema.getTypeMap();
    const isPublicObjectType = (type) => {
        // private types include things like __Schema, __Type, __Directive
        // those already have their own resolvers that we do not want to overwrite
        return (0, graphql_1.isObjectType)(type) && !type.name.startsWith('__');
    };
    Object.values(typeMap)
        .filter(isPublicObjectType)
        .forEach((gqlObject) => {
        const fields = gqlObject.getFields();
        Object.values(fields).forEach((field) => {
            field.resolve = externalResolver;
        });
    });
    const resolveOperation = (isMutation) => async (source, _args, executionRef, info) => {
        if (source.errors)
            return null;
        const { context, wrapper, wrapperVars } = source;
        const { dataLoaderOptions } = context;
        let transform;
        try {
            transform = (0, transformNestedSelection_1.default)(schema, info, prefix, wrapper);
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
    return (0, schema_1.mergeSchemas)({
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
        },
    });
};
exports.default = nestGraphQLEndpoint;
//# sourceMappingURL=nestGraphQLEndpoint.js.map