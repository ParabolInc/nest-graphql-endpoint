"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const pruneUnusedNodes = (info) => {
    const usedVariables = new Set();
    const usedFragmentSpreads = new Set();
    const fragmentDefinitions = [];
    const querySelectionSet = {
        kind: 'SelectionSet',
        selections: info.fieldNodes.flatMap(({ selectionSet }) => selectionSet.selections),
    };
    const variableDefinitions = info.operation.variableDefinitions || [];
    const fragments = info.fragments || {};
    const allVariables = info.variableValues || {};
    graphql_1.visit(querySelectionSet, {
        Variable(node) {
            const { name } = node;
            const { value } = name;
            usedVariables.add(value);
        },
        FragmentSpread(node) {
            const { name } = node;
            const { value } = name;
            usedFragmentSpreads.add(value);
        },
    });
    const prunedVariableDefinitions = variableDefinitions.filter((varDef) => {
        const { variable } = varDef;
        const { name } = variable;
        const { value } = name;
        return usedVariables.has(value);
    });
    Object.keys(fragments).forEach((fragmentName) => {
        if (usedFragmentSpreads.has(fragmentName)) {
            fragmentDefinitions.push(fragments[fragmentName]);
        }
    });
    const variables = {};
    usedVariables.forEach((variableName) => {
        variables[variableName] = allVariables[variableName];
    });
    return {
        variables,
        document: {
            kind: 'Document',
            definitions: [
                {
                    kind: info.operation.kind,
                    operation: info.operation.operation,
                    variableDefinitions: prunedVariableDefinitions,
                    selectionSet: querySelectionSet,
                },
                ...fragmentDefinitions,
            ],
        },
    };
};
const unprefixTypes = (document, prefix) => {
    return graphql_1.visit(document, {
        NamedType(node) {
            const { name } = node;
            const { value } = name;
            return {
                ...node,
                name: {
                    ...node.name,
                    value: value.startsWith(prefix) ? value.slice(prefix.length) : value,
                },
            };
        },
    });
};
const transformNestedSelection = (info, prefix) => {
    const { variables, document: prefixedDoc } = pruneUnusedNodes(info);
    const document = unprefixTypes(prefixedDoc, prefix);
    return { document, variables };
};
exports.default = transformNestedSelection;
//# sourceMappingURL=transformNestedSelection.js.map