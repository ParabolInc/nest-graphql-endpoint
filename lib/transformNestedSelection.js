"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const graphql_1 = require("graphql");
const pruneLocalTypes_1 = tslib_1.__importDefault(require("./pruneLocalTypes"));
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
const MAGIC_FRAGMENT_NAME = 'info';
// if the request is coming in via another type
// remove local types & fragments
// insert the fragment into the user-defined wrapper at the point of `...info`
// and when the value returns, remove the wrapper
const delocalizeDoc = (doc, prefix, info, wrapper) => {
    if (!wrapper)
        return { document: doc };
    const delocalizedDoc = pruneLocalTypes_1.default(doc, prefix, info);
    const { definitions } = delocalizedDoc;
    const firstDefinition = definitions[0];
    // TODO include wrapper + variables so we can cache this
    const { definitions: wrapperDefs } = wrapper;
    const [wrappedDefinition] = wrapperDefs;
    const wrappedPath = [];
    const joinedAST = graphql_1.visit(wrappedDefinition, {
        SelectionSet(node, _key, parent, _path, ancestors) {
            const { selections } = node;
            const [firstSelection] = selections;
            if (firstSelection.kind !== 'FragmentSpread')
                return undefined;
            const { name } = firstSelection;
            const { value } = name;
            if (value !== MAGIC_FRAGMENT_NAME)
                return undefined;
            ancestors.forEach((ancestor) => {
                if ('kind' in ancestor && ancestor.kind === 'Field') {
                    const { name } = ancestor;
                    const { value } = name;
                    wrappedPath.push(value);
                }
            });
            wrappedPath.push(parent.name.value);
            return firstDefinition.selectionSet;
        },
    });
    return {
        wrappedPath,
        document: {
            ...delocalizedDoc,
            definitions: [joinedAST, ...definitions.slice(1)],
        },
    };
};
const transformNestedSelection = (info, prefix, wrapper) => {
    const { variables, document: prefixedDoc } = pruneUnusedNodes(info);
    const { document: delocalizedDoc, wrappedPath } = delocalizeDoc(prefixedDoc, prefix, info, wrapper);
    const document = unprefixTypes(delocalizedDoc, prefix);
    return { document, variables, wrappedPath };
};
exports.default = transformNestedSelection;
//# sourceMappingURL=transformNestedSelection.js.map