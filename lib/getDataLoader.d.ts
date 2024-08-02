import { Options } from 'dataloader';
import { EndpointDataLoader, ExecutionRef } from './types';
declare const getDataLoader: (ref: ExecutionRef, dataLoaderOptions?: Options<any, any>) => EndpointDataLoader<any>;
export default getDataLoader;
