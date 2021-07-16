"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const visitDocFotPath = (path, selectionSetNode) => {
    let isPathInDoc = true;
    const findPathInDoc = (pathSlice, node) => {
        if (!pathSlice.length || !node)
            return;
        const [firstPathName] = pathSlice;
        const { selections } = node;
        const isSpread = firstPathName.startsWith('...');
        if (isSpread) {
            // always include errors in fragments (technically not correct)
            isPathInDoc = true;
            return;
        }
        const matchingChild = selections.find((selection) => selection.kind === 'Field' && selection.name.value === firstPathName);
        if (!matchingChild) {
            isPathInDoc = false;
            return;
        }
        const { selectionSet } = matchingChild;
        const nextPath = pathSlice.slice(1);
        findPathInDoc(nextPath, selectionSet);
    };
    findPathInDoc(path, selectionSetNode);
    return isPathInDoc;
};
const filterErrorsForDocument = (document, errors) => {
    if (!errors || !errors.length)
        return errors;
    const { definitions } = document;
    const operationNode = definitions.find((definition) => definition.kind === 'OperationDefinition');
    if (!operationNode)
        return errors;
    const { selectionSet, operation } = operationNode;
    const filteredErrors = errors.filter(({ path }) => {
        // If endpoint doesn't give us the path, don't filter it out
        if (!path || path.length === 0)
            return true;
        const [startField] = path;
        const testPath = startField.startsWith(operation) ? path.slice(1) : path;
        return visitDocFotPath(testPath, selectionSet);
    });
    return filteredErrors.length ? filteredErrors : null;
};
exports.default = filterErrorsForDocument;
//# sourceMappingURL=filterErrorsForDocument.js.map