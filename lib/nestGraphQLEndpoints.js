"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const schema_1 = require("@graphql-tools/schema");
const utils_1 = require("@graphql-tools/utils");
const graphql_1 = require("graphql");
const getNestedUsage_1 = require("./getNestedUsage");
// if a field is aliased in the request that alias will be the key in the `source` object
const externalResolver = (source, _args, _context, info) => {
    const key = info.fieldNodes[0].alias?.value ?? info.fieldName;
    return source[key];
};
const getExternalResolvers = (endpointTypeDefs) => {
    const resolvers = {};
    endpointTypeDefs.definitions.forEach((definition) => {
        if (definition.kind !== graphql_1.Kind.OBJECT_TYPE_DEFINITION &&
            definition.kind !== graphql_1.Kind.OBJECT_TYPE_EXTENSION) {
            return;
        }
        const fieldResolvers = (resolvers[definition.name.value] ??= {});
        definition.fields?.forEach((field) => {
            fieldResolvers[field.name.value] = { resolve: externalResolver };
        });
    });
    return resolvers;
};
// A nested type the parent schema gives its own interfaces needs those interfaces' fields
const getParentUsage = (parentSchema, prefix) => {
    const usage = {};
    Object.values(parentSchema.getTypeMap()).forEach((type) => {
        if (!type.name.startsWith(prefix) || !((0, graphql_1.isObjectType)(type) || (0, graphql_1.isInterfaceType)(type)))
            return;
        usage[type.name] = type.getInterfaces().flatMap((iface) => Object.keys(iface.getFields()));
    });
    return usage;
};
// Nesting every endpoint at once builds the merged schema once instead of once per endpoint
const nestGraphQLEndpoints = (parentSchema, endpoints, options = {}) => {
    const { usage, ...buildOptions } = options;
    const endpointTypeDefs = endpoints.map((endpoint) => endpoint.getTypeDefs(usage ? (0, getNestedUsage_1.mergeNestedUsage)(usage, getParentUsage(parentSchema, endpoint.prefix)) : undefined));
    const resolvers = endpoints.map((endpoint, idx) => ({
        ...getExternalResolvers(endpointTypeDefs[idx]),
        ...endpoint.resolvers,
    }));
    return (0, schema_1.makeExecutableSchema)({
        typeDefs: [
            ...[...endpointTypeDefs].reverse(),
            parentSchema,
            ...endpoints.map(({ parentTypeDefs }) => parentTypeDefs),
        ],
        resolvers: [(0, utils_1.getResolversFromSchema)(parentSchema), ...resolvers],
        ...buildOptions,
    });
};
exports.default = nestGraphQLEndpoints;
//# sourceMappingURL=nestGraphQLEndpoints.js.map