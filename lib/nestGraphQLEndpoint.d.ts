import getNestedUsage, { findMissingNestedField, mergeNestedUsage } from './getNestedUsage';
import nestGraphQLEndpoints from './nestGraphQLEndpoints';
import pruneTypeDefs from './pruneTypeDefs';
import { EndpointContext, NestedEndpoint, NestGraphQLEndpointParams } from './types';
declare const nestGraphQLEndpoint: <TContext extends EndpointContext>(params: NestGraphQLEndpointParams<TContext>) => NestedEndpoint;
export { findMissingNestedField, getNestedUsage, mergeNestedUsage, nestGraphQLEndpoints, pruneTypeDefs, };
export type { NestGraphQLEndpointsOptions } from './nestGraphQLEndpoints';
export * from './types';
export default nestGraphQLEndpoint;
