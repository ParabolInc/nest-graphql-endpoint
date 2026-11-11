import type DataLoader from 'dataloader'
import type {Options} from 'dataloader'
import type {DocumentNode, GraphQLResolveInfo, GraphQLSchema} from 'graphql'

export interface BaseGraphQLError {
  message: string
}
export interface GraphQLEndpointError extends BaseGraphQLError {
  message: string
  locations?: {
    line: number
    column: number
  }[]
  type?: string
  path?: (string | number)[]
}

export type EndpointResponseData = Record<string, unknown> | null
export interface EndpointExecutionResult {
  data: EndpointResponseData
  errors?: GraphQLEndpointError[] | null
}

export interface EndpointContext {
  accessToken?: string
  dataLoaderOptions?: Options<any, any>
  [key: string]: any
}

export type ExecutionRef = Record<string, unknown>

export type Variables = Record<string, unknown>

export interface AliasMapper {
  [aliasedName: string]: string
}

export type Executor<TContext> = (
  document: DocumentNode,
  variables: Variables,
  endpointTimeout: number,
  context: TContext,
) => EndpointExecutionResult | Promise<EndpointExecutionResult>

type ResolveEndpointContext<TContext> = (
  source: any,
  args: any,
  context: any,
  info: GraphQLResolveInfo,
) => TContext | Promise<TContext>

export interface NestGraphQLEndpointParams<TContext> {
  parentType: string
  fieldName: string
  resolveEndpointContext: ResolveEndpointContext<TContext>
  prefix: string
  executor: Executor<TContext>
  schemaIDL: string
  endpointTimeout?: number
  batchKey?: string
}

export interface DataLoaderKey<TContext> {
  document: DocumentNode
  variables: Variables
  context: TContext
  // options are per-execution
  options: {
    batchKey: string
    endpointTimeout: number
    executor: Executor<TContext>
    prefix: string
    isMutation: boolean
  }
}

export type EndpointDataLoader<TContext> = DataLoader<
  DataLoaderKey<TContext>,
  EndpointExecutionResult
>

export interface NestedSource<TContext extends EndpointContext> {
  context: TContext
  dataLoaderOptions: Omit<Options<any, any>, 'cache'>
  wrapperVars?: Variables
  wrapper?: DocumentNode
  errors?: BaseGraphQLError[] | null
  errorPromise?: Promise<BaseGraphQLError[] | null | undefined>
  resolveErrors?: (errors: GraphQLEndpointError[] | null | undefined) => void
}

interface AliasMapEntry {
  name: string
  children: AliasMap
}

export type AliasMap = Record<string, AliasMapEntry>

// The fields operations select on each nested type, keyed by the type's prefixed name.
// A type listed without fields is kept with as few fields as a valid schema allows
export type NestedUsage = Record<string, readonly string[]>

export interface NestedRequestInput<TVars> {
  query: string
  endpointContext: Record<string, any>
  info: GraphQLResolveInfo
  // only necessary if the query needs them
  variables?: TVars
  // to reuse a dataloader, pass in your execution context object
  batchRef?: Record<any, any>
}

export interface NestedRequestResult<TData> {
  data: TData
  errors: BaseGraphQLError[] | null | undefined
}

export type NestedResolvers = Record<string, Record<string, any>>

export interface NestedEndpoint {
  prefix: string
  // the endpoint's types with the prefix, only the parts `usage` needs when it is given
  getTypeDefs: (usage?: NestedUsage) => DocumentNode
  // the endpoint's own schema, without the prefix. The first nested request builds it
  getEndpointSchema: () => GraphQLSchema
  // the Api & Error types, and the field that extends the parent type with the Api
  parentTypeDefs: string
  resolvers: NestedResolvers
  // runs a query against the endpoint from inside a resolver, sharing the execution's batch
  request: <TData = any, TVars = any>(
    input: NestedRequestInput<TVars>,
  ) => Promise<NestedRequestResult<TData>>
}
