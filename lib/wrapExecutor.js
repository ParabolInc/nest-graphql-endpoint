"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const wrapExecutor = (executor) => async (document, variables, endpointTimeout, context) => {
    try {
        const response = await executor(document, variables, endpointTimeout, context);
        return response;
    }
    catch (e) {
        return {
            data: null,
            errors: [
                {
                    message: e?.message ?? `nesting executor failed`,
                },
            ],
        };
    }
};
exports.default = wrapExecutor;
//# sourceMappingURL=wrapExecutor.js.map