"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const renameResponseTypenames_1 = tslib_1.__importDefault(require("./renameResponseTypenames_"));
const wrapExecutor = (executor, prefix) => async (document, variables, endpointTimeout, context) => {
    try {
        const response = await executor(document, variables, endpointTimeout, context);
        renameResponseTypenames_1.default(response, prefix);
        return response;
    }
    catch (e) {
        return {
            data: null,
            errors: [
                {
                    message: e?.message ?? `${prefix}: Executor failed`,
                },
            ],
        };
    }
};
exports.default = wrapExecutor;
//# sourceMappingURL=wrapExecutor.js.map