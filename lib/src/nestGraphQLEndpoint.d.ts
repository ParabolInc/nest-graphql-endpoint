import { GraphQLSchema } from 'graphql';
import { NestGraphQLEndpointParams } from './types';
declare const nestGraphQLEndpoint: <TContext>(params: NestGraphQLEndpointParams<TContext>) => GraphQLSchema;
export default nestGraphQLEndpoint;
