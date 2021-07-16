"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const renameResponseTypenames = (response, prefix) => {
    const prefixTypename = (name) => `${prefix}${name}`;
    const transformObject_ = (parent) => {
        Object.keys(parent).forEach((key) => {
            const val = parent[key];
            if (key === '__typename') {
                parent[key] = prefixTypename(val);
            }
            else if (Array.isArray(val)) {
                val.forEach((child) => {
                    transformObject_(child);
                });
            }
            else if (typeof val === 'object' && val !== null) {
                transformObject_(val);
            }
        });
    };
    transformObject_(response);
};
exports.default = renameResponseTypenames;
//# sourceMappingURL=renameResponseTypenames_.js.map