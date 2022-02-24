"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const renameResponseTypenames = (response, prefix, aliasMaps) => {
    if (!response)
        return;
    const prefixTypename = (name) => `${prefix}${name}`;
    const transformObject_ = (parent, aliasMap) => {
        Object.keys(aliasMap).forEach((key) => {
            const val = parent[key];
            const entry = aliasMap[key];
            const { name, children } = entry;
            if (name === '__typename') {
                parent[key] = prefixTypename(val);
            }
            else if (Array.isArray(val)) {
                val.forEach((child) => {
                    transformObject_(child, children);
                });
            }
            else if (typeof val === 'object' && val !== null) {
                transformObject_(val, children);
            }
        });
    };
    aliasMaps.forEach((aliasMap) => {
        transformObject_(response, aliasMap);
    });
};
exports.default = renameResponseTypenames;
//# sourceMappingURL=renameResponseTypenames_.js.map