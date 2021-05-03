import { DataLoaderKey, EndpointExecutionResult } from './types';
declare const batchFn: <TContext extends Record<string, any>>(keys: readonly DataLoaderKey<TContext>[]) => Promise<EndpointExecutionResult[]>;
export default batchFn;
