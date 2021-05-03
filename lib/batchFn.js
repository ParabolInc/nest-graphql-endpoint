"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const dealiasResult_1 = tslib_1.__importDefault(require("./dealiasResult"));
const filterErrorsForDocument_1 = tslib_1.__importDefault(require("./filterErrorsForDocument"));
const mergeGQLDocuments_1 = tslib_1.__importDefault(require("./mergeGQLDocuments"));
const wrapExecutor_1 = tslib_1.__importDefault(require("./wrapExecutor"));
const batchFn = async (keys) => {
    const [firstKey] = keys;
    const { options } = firstKey;
    const { batchKey, executor, isMutation, prefix } = options;
    const wrappedExecutor = wrapExecutor_1.default(executor, prefix);
    const execParamsByToken = keys.reduce((obj, key, idx) => {
        const { context } = key;
        const accessToken = context[batchKey];
        if (typeof accessToken !== 'string') {
            throw new Error('Access token not provided');
        }
        if (!accessToken)
            return obj;
        obj[accessToken] = obj[accessToken] || [];
        obj[accessToken].push({
            document: key.document,
            variables: key.variables,
            context,
            idx
        });
        return obj;
    }, {});
    const results = [];
    await Promise.all(Object.values(execParamsByToken).map(async (execParams) => {
        const [firstParam] = execParams;
        // context is per-fetch
        const { context } = firstParam;
        const { document, variables, aliasMappers } = mergeGQLDocuments_1.default(execParams, isMutation);
        const result = await wrappedExecutor(document, variables, context);
        const { errors, data } = result;
        execParams.forEach((execParam, idx) => {
            const aliasMapper = aliasMappers[idx];
            const { idx: resultsIdx, document } = execParam;
            results[resultsIdx] = {
                data: dealiasResult_1.default(data, aliasMapper),
                errors: filterErrorsForDocument_1.default(document, errors)
            };
        });
    }));
    return results;
};
exports.default = batchFn;
//# sourceMappingURL=batchFn.js.map