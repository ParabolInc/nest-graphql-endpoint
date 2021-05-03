"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const addNewFragmentDefinition_ = (baseDefinitions, definition) => {
    const { name } = definition;
    const { value: definitionName } = name;
    const baseFragmentNames = new Set();
    baseDefinitions.forEach((definition) => {
        if (definition.kind === 'FragmentDefinition') {
            baseFragmentNames.add(definition.name.value);
        }
    });
    if (!baseFragmentNames.has(definitionName)) {
        baseDefinitions.push(definition);
    }
};
const getSelectionNamesAndAliases = (selections) => {
    const usedNames = new Set();
    selections.forEach((selection) => {
        if (selection.kind !== 'Field')
            return;
        const key = selection.alias?.value ?? selection.name.value;
        usedNames.add(key);
    });
    return usedNames;
};
const gqlNodesAreEqual = (leftNode, rightNode) => {
    return graphql_1.print(leftNode) === graphql_1.print(rightNode);
};
const aliasFieldNode = (node, alias) => {
    return {
        ...node,
        alias: {
            kind: 'Name',
            value: alias
        }
    };
};
const addNewVariableDefinitions_ = (baseVarDefs, variableDefinitions) => {
    variableDefinitions.forEach((curVarDef) => {
        const { variable } = curVarDef;
        const { name } = variable;
        const { value: varDefName } = name;
        const isPresent = baseVarDefs.find((varDef) => {
            varDef.variable.name.value === varDefName;
        });
        if (!isPresent) {
            baseVarDefs.push(curVarDef);
        }
    });
};
const addNewSelections_ = (baseSelections, selections, aliasIdx, aliasMapper, isMutation) => {
    selections.forEach((selection) => {
        if (selection.kind === 'InlineFragment') {
            // GQL engine will dedupe if there are multiple that are exactly the same
            baseSelections.push(selection);
            return;
        }
        const { name } = selection;
        const { value: selectionName } = name;
        if (selection.kind === 'FragmentSpread') {
            // if it's a new fragment spread, add it, else ignore
            const existingFrag = baseSelections.find((selection) => selection.kind === 'FragmentSpread' && selection.name.value === selectionName);
            if (!existingFrag) {
                baseSelections.push(selection);
            }
            return;
        }
        // if it's a new field node, add it
        const existingField = baseSelections.find((selection) => selection.kind === 'Field' && selection.name.value === selectionName);
        if (!existingField) {
            baseSelections.push(selection);
            return;
        }
        // If this node is already present, don't include it again
        // Mutations are the exception. we want to run them all
        if (!isMutation && gqlNodesAreEqual(existingField, selection))
            return;
        // if the node has the same name but different children or arguments, alias it
        // there is some high hanging fruit where we could alias the children inside this
        const usedNames = getSelectionNamesAndAliases(baseSelections);
        let aliasedName = `${selectionName}_${aliasIdx}`;
        while (usedNames.has(aliasedName)) {
            aliasedName = `${aliasedName}X`;
        }
        const aliasedSelection = aliasFieldNode(selection, aliasedName);
        aliasMapper[aliasedName] = selection.alias?.value ?? selectionName;
        baseSelections.push(aliasedSelection);
    });
};
const addNewOperationDefinition_ = (baseDefinitions, definition, aliasIdx, aliasMapper, isMutation) => {
    const { operation, variableDefinitions, selectionSet } = definition;
    // add completely new ops
    const matchingOp = baseDefinitions.find((curDef) => curDef.kind === 'OperationDefinition' && curDef.operation === operation);
    if (!matchingOp) {
        baseDefinitions.push(definition);
        return;
    }
    // merge var defs
    const { variableDefinitions: baseVarDefs, selectionSet: baseSelectionSet } = matchingOp;
    const { selections: baseSelections } = baseSelectionSet;
    addNewVariableDefinitions_(baseVarDefs, variableDefinitions);
    // merge selection set
    const { selections } = selectionSet;
    addNewSelections_(baseSelections, selections, aliasIdx, aliasMapper, isMutation);
};
const mergeGQLDocuments = (cachedExecParams, isMutation) => {
    if (cachedExecParams.length === 1) {
        return {
            ...cachedExecParams[0],
            aliasMappers: [{}]
        };
    }
    const aliasMappers = [];
    const baseDefinitions = [];
    const baseVariables = {};
    cachedExecParams.forEach((execParams, aliasIdx) => {
        const aliasMapper = {};
        const { document, variables } = execParams;
        const { definitions } = document;
        definitions.forEach((definition) => {
            if (definition.kind === 'OperationDefinition') {
                addNewOperationDefinition_(baseDefinitions, definition, aliasIdx, aliasMapper, !!isMutation);
            }
            else if (definition.kind === 'FragmentDefinition') {
                addNewFragmentDefinition_(baseDefinitions, definition);
            }
        });
        Object.assign(baseVariables, variables);
        aliasMappers.push(aliasMapper);
    });
    const mergedDoc = {
        kind: 'Document',
        definitions: baseDefinitions
    };
    return { document: mergedDoc, variables: baseVariables, aliasMappers };
};
exports.default = mergeGQLDocuments;
//# sourceMappingURL=mergeGQLDocuments.js.map