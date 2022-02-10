"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dealiasResult = (data, aliasMap) => {
    const usesAlias = Object.keys(aliasMap).length > 0;
    if (!usesAlias || !data)
        return data;
    const returnData = {
        ...data,
    };
    Object.entries(aliasMap).forEach(([alias, name]) => {
        returnData[name] = returnData[alias];
        delete returnData[alias];
    });
    return returnData;
};
exports.default = dealiasResult;
//# sourceMappingURL=dealiasResult.js.map
