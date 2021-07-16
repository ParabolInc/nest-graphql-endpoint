"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fast_json_stable_stringify_1 = tslib_1.__importDefault(require("fast-json-stable-stringify"));
const fs_1 = tslib_1.__importDefault(require("fs"));
const graphql_1 = require("graphql");
const pruneLocalTypes_1 = tslib_1.__importDefault(require("./pruneLocalTypes"));
// Transform the info fieldNodes into a standalone document AST
const transformInfoIntoDoc = (info) => {
    return {
        kind: 'Document',
        definitions: [
            {
                kind: info.operation.kind,
                operation: info.operation.operation,
                variableDefinitions: info.operation.variableDefinitions || [],
                selectionSet: {
                    kind: 'SelectionSet',
                    selections: info.fieldNodes.flatMap(({ selectionSet }) => selectionSet.selections),
                },
            },
            ...Object.values(info.fragments || {}),
        ],
    };
};
// remove unused fragDefs, varDefs, and variables
const pruneUnusedNodes = (doc, allVariables) => {
    const usedVariables = new Set();
    const usedFragmentSpreads = new Set();
    const { definitions } = doc;
    const opDef = definitions.find(({ kind }) => kind === 'OperationDefinition');
    graphql_1.visit(opDef.selectionSet, {
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
    const variableDefinitions = opDef.variableDefinitions || [];
    const prunedOpDef = {
        ...opDef,
        variableDefinitions: variableDefinitions.filter((varDef) => {
            const { variable } = varDef;
            const { name } = variable;
            const { value } = name;
            return usedVariables.has(value);
        }),
    };
    console.log('DEFS', JSON.stringify(definitions));
    const prunedFragDefs = definitions.filter((definition) => definition.kind === 'FragmentDefinition' && usedFragmentSpreads.has(definition.name.value));
    const variables = {};
    usedVariables.forEach((variableName) => {
        variables[variableName] = allVariables[variableName];
    });
    return {
        variables,
        document: {
            ...doc,
            definitions: [prunedOpDef, ...prunedFragDefs],
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
const delocalizeDoc = (prefix, info, wrapper) => {
    // TODO cache on wrapper input string
    const wrappedPath = [];
    const mergedDoc = graphql_1.visit(wrapper, {
        SelectionSet(node, _key, parent, _path, ancestors) {
            const { selections } = node;
            const [firstSelection] = selections;
            if (firstSelection.kind !== 'FragmentSpread')
                return undefined;
            const { name } = firstSelection;
            const { value } = name;
            if (value !== MAGIC_FRAGMENT_NAME)
                return undefined;
            if (wrappedPath.length)
                throw new Error(`Only one ...${MAGIC_FRAGMENT_NAME} is allowed`);
            ancestors.forEach((ancestor) => {
                if ('kind' in ancestor && ancestor.kind === 'Field') {
                    const { name } = ancestor;
                    const { value } = name;
                    wrappedPath.push(value);
                }
            });
            wrappedPath.push(parent.name.value);
            return {
                kind: 'SelectionSet',
                selections: info.fieldNodes.flatMap(({ selectionSet }) => selectionSet.selections),
            };
        },
    });
    // if ...info was not used, then the wrapper is user defined & we don't need to do anything
    if (wrappedPath.length === 0) {
        return { document: mergedDoc };
    }
    // removed any fragments that may not refer to endpoint types
    const delocalizedDoc = pruneLocalTypes_1.default(mergedDoc, prefix, info);
    // turn info into a doc
    const infoDoc = transformInfoIntoDoc(info);
    const docs = [delocalizedDoc, infoDoc];
    const opDefs = docs.map(({ definitions }) => definitions.find(({ kind }) => kind === 'OperationDefinition'));
    const fragDefs = docs.flatMap(({ definitions }) => definitions.filter(({ kind }) => kind === 'FragmentDefinition'));
    const [delocalizedOpDef] = opDefs;
    const mergedOpDef = {
        ...delocalizedOpDef,
        // merge var defs from both
        variableDefinitions: opDefs.flatMap((op) => op.variableDefinitions || []),
    };
    const mergedDefDoc = {
        ...delocalizedDoc,
        // merge frag defs from both
        definitions: [mergedOpDef, ...fragDefs],
    };
    return { wrappedPath, document: mergedDefDoc };
};
const transformNestedSelection = (info, prefix, wrapper) => {
    console.log('transforming no wrapper');
    if (!wrapper) {
        console.log('transforming no wrapper');
        const infoDoc = transformInfoIntoDoc(info);
        const { variables, document: prefixedDoc } = pruneUnusedNodes(infoDoc, info.variableValues);
        const document = unprefixTypes(prefixedDoc, prefix);
        return { document, variables };
    }
    console.log('transforming wrapper', wrapper);
    fs_1.default.writeFileSync('info.json', fast_json_stable_stringify_1.default(info, { cycles: true }));
    fs_1.default.writeFileSync('wrapper.json', fast_json_stable_stringify_1.default(wrapper));
    try {
        const { document: delocalizedDoc, wrappedPath } = delocalizeDoc(prefix, info, wrapper);
        const { variables, document: prefixedDoc } = pruneUnusedNodes(delocalizedDoc, info.variableValues);
        const document = unprefixTypes(prefixedDoc, prefix);
        return { document, variables, wrappedPath };
    }
    catch (e) {
        console.log(e.stack);
        throw e;
    }
    // if there's no wrapper then just pruneUnusedNodes & unprefixTypes
    // if there is a wrapper
    // first, check the wrapper for the info fragment
    // if it has no info fragment, then done
    // if the wrapper has an info frag
    // if it has an info frag, then locate that info frag & replace it with the fieldNodes & then pruneUnusedNodes & unprefixTypes
    // const {variables, document: prefixedDoc} = pruneUnusedNodes(info)
};
exports.default = transformNestedSelection;
//# sourceMappingURL=transformNestedSelection.js.map