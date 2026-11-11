"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeNestedUsage = exports.findMissingNestedField = void 0;
const graphql_1 = require("graphql");
// The nested types & fields that the documents select, so a schema can be built with only those
const getNestedUsage = (schema, documents, prefixes) => {
    const usage = new Map();
    const use = (typeName, fieldName) => {
        if (!prefixes.some((prefix) => typeName.startsWith(prefix)))
            return;
        const fieldNames = usage.get(typeName) ?? new Set();
        usage.set(typeName, fieldNames);
        if (fieldName && !fieldName.startsWith('__'))
            fieldNames.add(fieldName);
    };
    documents.forEach((document) => {
        const typeInfo = new graphql_1.TypeInfo(schema);
        (0, graphql_1.visit)(document, (0, graphql_1.visitWithTypeInfo)(typeInfo, {
            Field(node) {
                const parentType = typeInfo.getParentType();
                if (parentType && typeInfo.getFieldDef())
                    use(parentType.name, node.name.value);
            },
            InlineFragment(node) {
                if (node.typeCondition)
                    use(node.typeCondition.name.value);
            },
            FragmentDefinition(node) {
                use(node.typeCondition.name.value);
            },
        }));
    });
    return Object.fromEntries([...usage.keys()].sort().map((typeName) => [typeName, [...usage.get(typeName)].sort()]));
};
// The first nested type or field the document uses that the schema left out, e.g. to run it on a schema with every nested type.
// A field the endpoint doesn't have either is the document's mistake, not one the schema left out.
// Introspection describes the whole schema, so __schema and __type count as left out
const findMissingNestedField = (schema, document, endpoints) => {
    const getEndpointType = (typeName) => {
        const endpoint = endpoints.find(({ prefix }) => typeName.startsWith(prefix));
        return endpoint?.getEndpointSchema().getType(typeName.slice(endpoint.prefix.length));
    };
    const typeInfo = new graphql_1.TypeInfo(schema);
    let missing;
    const checkType = (typeName) => {
        if (schema.getType(typeName) || !getEndpointType(typeName))
            return undefined;
        missing = typeName;
        return graphql_1.BREAK;
    };
    (0, graphql_1.visit)(document, (0, graphql_1.visitWithTypeInfo)(typeInfo, {
        Field(node) {
            const parentType = typeInfo.getParentType();
            const fieldName = node.name.value;
            if (fieldName === '__schema' || fieldName === '__type') {
                missing = fieldName;
                return graphql_1.BREAK;
            }
            if (!parentType || fieldName.startsWith('__') || typeInfo.getFieldDef())
                return undefined;
            const endpointType = getEndpointType(parentType.name);
            const hasField = ((0, graphql_1.isObjectType)(endpointType) || (0, graphql_1.isInterfaceType)(endpointType)) &&
                fieldName in endpointType.getFields();
            if (!hasField)
                return undefined;
            missing = `${parentType.name}.${fieldName}`;
            return graphql_1.BREAK;
        },
        InlineFragment(node) {
            return node.typeCondition ? checkType(node.typeCondition.name.value) : undefined;
        },
        FragmentDefinition(node) {
            return checkType(node.typeCondition.name.value);
        },
    }));
    return missing;
};
exports.findMissingNestedField = findMissingNestedField;
const mergeNestedUsage = (...usages) => {
    const merged = new Map();
    usages.forEach((usage) => {
        Object.entries(usage).forEach(([typeName, fieldNames]) => {
            merged.set(typeName, new Set([...(merged.get(typeName) ?? []), ...fieldNames]));
        });
    });
    return Object.fromEntries([...merged].map(([typeName, fieldNames]) => [typeName, [...fieldNames]]));
};
exports.mergeNestedUsage = mergeNestedUsage;
exports.default = getNestedUsage;
//# sourceMappingURL=getNestedUsage.js.map