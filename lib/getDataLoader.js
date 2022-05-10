"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const dataloader_1 = tslib_1.__importDefault(require("dataloader"));
const batchFn_1 = tslib_1.__importDefault(require("./batchFn"));
const dataloaderCache = new WeakMap();
const getDataLoader = (ref, dataLoaderOptions) => {
    const existingDataLoader = dataloaderCache.get(ref);
    if (existingDataLoader)
        return existingDataLoader;
    const newDataLoader = new dataloader_1.default(batchFn_1.default, {
        ...dataLoaderOptions,
        cache: false,
    });
    dataloaderCache.set(ref, newDataLoader);
    return newDataLoader;
};
exports.default = getDataLoader;
//# sourceMappingURL=getDataLoader.js.map