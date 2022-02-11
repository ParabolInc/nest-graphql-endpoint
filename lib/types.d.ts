import DataLoader from 'dataloader';
import { DocumentNode, GraphQLResolveInfo, GraphQLSchema } from 'graphql';
export interface BaseGraphQLError {
    message: string;
}
export interface GraphQLEndpointError extends BaseGraphQLError {
    message: string;
    locations?: {
        line: number;
        column: number;
    }[];
    type?: string;
    path?: string[];
}
export declare type EndpointResponseData = Record<string, unknown> | null;
export interface EndpointExecutionResult {
    data: EndpointResponseData;
    errors?: GraphQLEndpointError[] | null;
}
export interface EndpointContext {
    accessToken?: string;
    [key: string]: any;
}
export declare type ExecutionRef = Record<string, unknown>;
export declare type Variables = Record<string, unknown>;
export interface AliasMapper {
    [aliasedName: string]: string;
}
export declare type Executor<TContext> = (document: DocumentNode, variables: Variables, endpointTimeout: number, context: TContext) => EndpointExecutionResult | Promise<EndpointExecutionResult>;
declare type ResolveEndpointContext<TContext> = (source: any, args: any, context: any, info: GraphQLResolveInfo) => TContext | Promise<TContext>;
export interface NestGraphQLEndpointParams<TContext> {
    parentSchema: GraphQLSchema;
    parentType: string;
    fieldName: string;
    resolveEndpointContext: ResolveEndpointContext<TContext>;
    prefix: string;
    executor: Executor<TContext>;
    schemaIDL: string;
    endpointTimeout?: number;
    batchKey?: string;
}
export interface DataLoaderKey<TContext> {
    document: DocumentNode;
    variables: Variables;
    context: TContext;
    options: {
        batchKey: string;
        endpointTimeout: number;
        executor: Executor<TContext>;
        prefix: string;
        isMutation: boolean;
    };
}
export declare type EndpointDataLoader<TContext> = DataLoader<DataLoaderKey<TContext>, EndpointExecutionResult>;
export interface NestedSource<TContext> {
    context: TContext;
    wrapperVars?: Variables;
    wrapper?: DocumentNode;
    errors?: BaseGraphQLError[] | null;
    errorPromise?: Promise<BaseGraphQLError[] | null | undefined>;
    resolveErrors?: (errors: GraphQLEndpointError[] | null | undefined) => void;
}
interface AliasMapEntry {
    name: string;
    children: AliasMap;
}
export declare type AliasMap = Record<string, AliasMapEntry>;
export {};
