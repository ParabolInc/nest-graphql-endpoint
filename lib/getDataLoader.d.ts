import DataLoader from 'dataloader';
import { EndpointDataLoader, ExecutionRef } from './types';
declare const getDataLoader: (ref: ExecutionRef, dataLoaderOptions?: DataLoader.Options<any, any, any> | undefined) => EndpointDataLoader<any>;
export default getDataLoader;
