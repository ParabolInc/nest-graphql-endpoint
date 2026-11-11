import { GraphQLSchema } from 'graphql';
import { NestedEndpoint, NestedUsage } from './types';
export interface NestGraphQLEndpointsOptions {
    usage?: NestedUsage | null;
    assumeValidSDL?: boolean;
    updateResolversInPlace?: boolean;
}
declare const nestGraphQLEndpoints: (parentSchema: GraphQLSchema, endpoints: readonly NestedEndpoint[], options?: NestGraphQLEndpointsOptions) => GraphQLSchema;
export default nestGraphQLEndpoints;
