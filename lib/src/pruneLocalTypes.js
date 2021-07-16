"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const pruneLocalTypes = (doc, prefix, info) => {
    const { returnType, schema } = info;
    let rootType = returnType;
    if (typeof rootType === 'string') {
        rootType = { name: rootType };
    }
    else {
        while (graphql_1.isWrappingType(rootType)) {
            rootType = rootType.ofType;
        }
    }
    if (rootType.name.startsWith(prefix) || graphql_1.isLeafType(rootType))
        return doc;
    // we know the type is a local type, which means it's either an interface or union
    let errorMultipleTypes = undefined;
    const fragmentVisitor = (node) => {
        const { typeCondition } = node;
        if (!typeCondition)
            return;
        const { name } = typeCondition;
        const { value } = name;
        // if the fragment is native to the endpoint, ignore
        if (value.startsWith(prefix))
            return undefined;
        const valueType = schema.getType(value);
        // if the fragment is not endpoint-native & it cannot resolve to one, delete it
        if (!graphql_1.isAbstractType(valueType))
            return null;
        //
        const allowableTypes = schema
            .getPossibleTypes(valueType)
            .map((type) => type.name)
            .filter((name) => name.startsWith(prefix));
        // if the fragment cannot resolve to an endpoint-native type, delete it
        if (allowableTypes.length === 0)
            return null;
        // if the fragment could resolve to more than 1 endpoint-native type
        // the fragment needs to be rewritten (or we need a PR)
        if (allowableTypes.length > 1) {
            errorMultipleTypes = allowableTypes;
            return graphql_1.BREAK;
        }
        const [firstType] = allowableTypes;
        // change the type to an endpoint-native type
        return {
            ...node,
            typeCondition: {
                ...typeCondition,
                name: {
                    ...name,
                    value: firstType,
                },
            },
        };
    };
    const fixedDoc = graphql_1.visit(doc, {
        InlineFragment: fragmentVisitor,
        FragmentDefinition: fragmentVisitor,
    });
    if (errorMultipleTypes) {
        throw new Error(`Could not resolve ${rootType.name} to a single endpoint type. Got ${errorMultipleTypes}. Please fragment on each of those types or make a PR`);
    }
    return fixedDoc;
};
exports.default = pruneLocalTypes;
//# sourceMappingURL=pruneLocalTypes.js.map