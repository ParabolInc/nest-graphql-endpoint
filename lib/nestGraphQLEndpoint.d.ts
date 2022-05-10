import { GraphQLSchema } from 'graphql';
import { EndpointContext, NestGraphQLEndpointParams } from './types';
declare const nestGraphQLEndpoint: <TContext extends EndpointContext>(params: NestGraphQLEndpointParams<TContext>) => GraphQLSchema;
export default nestGraphQLEndpoint;
