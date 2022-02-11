"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const printArgs = (argArr) => {
    return graphql_1.print({
        kind: 'Field',
        name: {
            kind: 'Name',
            value: '',
        },
        arguments: argArr,
    });
};
const areArgsEqual = (aArgs, bArgs) => {
    if (aArgs && bArgs) {
        if (aArgs.length !== bArgs.length)
            return false;
        // field args are already sorted
        return printArgs(aArgs) === printArgs(bArgs);
    }
    return aArgs === bArgs;
};
exports.default = areArgsEqual;
//# sourceMappingURL=areArgsEqual.js.map