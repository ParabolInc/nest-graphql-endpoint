"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const areArgsEqual_1 = tslib_1.__importDefault(require("./areArgsEqual"));
const areDirectivesEqual = (aDirectives, bDirectives) => {
    if (aDirectives && bDirectives) {
        if (aDirectives.length !== bDirectives.length)
            return false;
        for (let i = 0; i < bDirectives.length; i++) {
            const aDir = aDirectives[i];
            const bDir = bDirectives[i];
            // make sure directives have same name
            if (aDir.name.value !== bDir.name.value)
                return false;
            const areEqual = areArgsEqual_1.default(aDir.arguments, bDir.arguments);
            if (!areEqual)
                return false;
        }
        return true;
    }
    return aDirectives === bDirectives;
};
exports.default = areDirectivesEqual;
//# sourceMappingURL=areDirectivesEqual.js.map