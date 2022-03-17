"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const graphql_1 = require("graphql");
const pruneInterfaces_1 = tslib_1.__importDefault(require("./pruneInterfaces"));
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
                    // probably a cleaner way to go about this...
                    selections: JSON.parse(JSON.stringify(info.fieldNodes.flatMap(({ selectionSet }) => selectionSet.selections))),
                },
            },
            ...Object.values(info.fragments || {}),
        ],
    };
};
// remove unused fragDefs, varDefs, and variables
const pruneUnused = (doc, allVariables) => {
    const usedVariables = new Set();
    const usedFragmentSpreads = new Set();
    const { definitions } = doc;
    const opDef = definitions.find(({ kind }) => kind === 'OperationDefinition');
    const nextSelectionSet = graphql_1.visit(opDef.selectionSet, {
        Variable(node) {
            const { name } = node;
            const { value } = name;
            usedVariables.add(value);
        },
        FragmentSpread(node) {
            const { name } = node;
            const { value } = name;
            const fragmentDefinition = definitions.find((definition) => definition.kind === 'FragmentDefinition' && definition.name.value === value);
            // the fragmentDefinition may have been removed by pruneLocalTypes
            if (!fragmentDefinition)
                return null;
            usedFragmentSpreads.add(value);
            return undefined;
        },
    });
    const variableDefinitions = opDef.variableDefinitions || [];
    const prunedOpDef = {
        ...opDef,
        selectionSet: nextSelectionSet,
        variableDefinitions: variableDefinitions.filter((varDef) => {
            const { variable } = varDef;
            const { name } = variable;
            const { value } = name;
            return usedVariables.has(value);
        }),
    };
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
// If the nested schema was extended, those types can appear in the selection set but should not be sent to the endpoint
const pruneExtendedFields = (schema, document) => {
    const typeInfo = new graphql_1.TypeInfo(schema);
    return graphql_1.visit(document, graphql_1.visitWithTypeInfo(typeInfo, {
        Field() {
            return typeInfo.getFieldDef() ? undefined : null;
        },
    }));
};
const MAGIC_FRAGMENT_NAME = 'info';
// if the request is coming in via a wrapper
// inject fieldNodes at the magic fragment spread
// record the path so the returned value ignores the wrapper
const mergeFieldNodesAndWrapper = (fieldNodesDoc, wrapper) => {
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
            const { definitions } = fieldNodesDoc;
            const fieldNodesOpDef = definitions.find((def) => def.kind === 'OperationDefinition');
            return fieldNodesOpDef.selectionSet;
        },
    });
    // if magic fragment spread was not used, return early
    if (wrappedPath.length === 0)
        return { document: mergedDoc };
    const docs = [mergedDoc, fieldNodesDoc];
    const opDefs = docs.map(({ definitions }) => definitions.find(({ kind }) => kind === 'OperationDefinition'));
    const fragDefs = docs.flatMap(({ definitions }) => definitions.filter(({ kind }) => kind === 'FragmentDefinition'));
    const [mergedOpDef] = opDefs;
    const mergedDocAndDefs = {
        ...mergedDoc,
        definitions: [
            {
                ...mergedOpDef,
                variableDefinitions: opDefs.flatMap((op) => op.variableDefinitions || []),
            },
            ...fragDefs,
        ],
    };
    return { wrappedPath, document: mergedDocAndDefs };
};
const transformNestedSelection = (schema, info, prefix, wrapper) => {
    if (!wrapper) {
        const infoDoc = transformInfoIntoDoc(info);
        const { variables, document: prefixedDoc } = pruneUnused(infoDoc, info.variableValues);
        const unprefixedDocument = unprefixTypes(prefixedDoc, prefix);
        const document = pruneExtendedFields(schema, unprefixedDocument);
        return { document, variables, wrappedPath: undefined };
    }
    const fieldNodesDoc = transformInfoIntoDoc(info);
    const fieldNodesWithoutLocalInterfacesDoc = pruneInterfaces_1.default(fieldNodesDoc, prefix, info);
    const unprefixedFieldNodesDoc = unprefixTypes(fieldNodesWithoutLocalInterfacesDoc, prefix);
    const { document: mergedDoc, wrappedPath } = mergeFieldNodesAndWrapper(unprefixedFieldNodesDoc, wrapper);
    // pruneExtended must come after merging the wrapper into the document
    // because before that, the wrapper is an invalid operation living on the query instead
    // it must be moved to its correct location and then the TypeInfo will yield the correct result
    const fieldNodesWithoutExtendedFields = pruneExtendedFields(schema, mergedDoc);
    const { variables, document } = pruneUnused(fieldNodesWithoutExtendedFields, info.variableValues);
    return { document, variables, wrappedPath };
};
exports.default = transformNestedSelection;
//# sourceMappingURL=transformNestedSelection.js.map