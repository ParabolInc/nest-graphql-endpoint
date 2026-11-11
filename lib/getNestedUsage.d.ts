import { DocumentNode, GraphQLSchema } from 'graphql';
import { NestedEndpoint, NestedUsage } from './types';
declare const getNestedUsage: (schema: GraphQLSchema, documents: readonly DocumentNode[], prefixes: readonly string[]) => NestedUsage;
type EndpointSchemaSource = Pick<NestedEndpoint, 'prefix' | 'getEndpointSchema'>;
export declare const findMissingNestedField: (schema: GraphQLSchema, document: DocumentNode, endpoints: readonly EndpointSchemaSource[]) => string | undefined;
export declare const mergeNestedUsage: (...usages: NestedUsage[]) => NestedUsage;
export default getNestedUsage;
