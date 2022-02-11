"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dealiasResult = (data, aliasMap) => {
    if (!data || Object.keys(aliasMap).length === 0)
        return data;
    const returnData = {};
    Object.entries(aliasMap).forEach(([alias, { name, children }]) => {
        const rawValue = data[alias];
        if (Array.isArray(rawValue)) {
            returnData[name] = rawValue.map((obj) => dealiasResult(obj, children));
        }
        else if (rawValue && typeof rawValue === 'object') {
            returnData[name] = dealiasResult(rawValue, children);
        }
        else {
            returnData[name] = rawValue;
        }
    });
    return returnData;
};
exports.default = dealiasResult;
//# sourceMappingURL=dealiasResult.js.map