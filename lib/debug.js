"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const info_json_1 = tslib_1.__importDefault(require("./info.json"));
const transformNestedSelection_1 = tslib_1.__importDefault(require("./src/transformNestedSelection"));
const wrapper_json_1 = tslib_1.__importDefault(require("./wrapper.json"));
const doStuff = async () => {
    const res = transformNestedSelection_1.default(info_json_1.default, '_xGitHub', wrapper_json_1.default);
    return res;
};
doStuff();
//# sourceMappingURL=debug.js.map