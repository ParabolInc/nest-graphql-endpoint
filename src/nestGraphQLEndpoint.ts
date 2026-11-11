import {
  buildSchema,
  type GraphQLObjectType,
  type GraphQLResolveInfo,
  type GraphQLSchema,
  Kind,
  type OperationDefinitionNode,
  parse,
} from 'graphql'
import getRequestDataLoader from './getDataLoader.ts'
import getNestedUsage, {findMissingNestedField, mergeNestedUsage} from './getNestedUsage.ts'
import nestGraphQLEndpoints from './nestGraphQLEndpoints.ts'
import prefixTypeDefs, {isNestableDefinition} from './prefixTypeDefs.ts'
import pruneTypeDefs from './pruneTypeDefs.ts'
import transformNestedSelection from './transformNestedSelection.ts'
import type {
  EndpointContext,
  ExecutionRef,
  NestedEndpoint,
  NestedRequestInput,
  NestedSource,
  NestedUsage,
  NestGraphQLEndpointParams,
} from './types.ts'

const nestGraphQLEndpoint = <TContext extends EndpointContext>(
  params: NestGraphQLEndpointParams<TContext>,
): NestedEndpoint => {
  const {
    parentType,
    fieldName,
    resolveEndpointContext,
    executor,
    schemaIDL,
    prefix,
    batchKey = 'accessToken',
    endpointTimeout = 10000,
  } = params

  const getTypeDefs = (usage?: NestedUsage) => {
    const document = parse(schemaIDL, {noLocation: true})
    const nestableDocument = {
      ...document,
      definitions: document.definitions.filter(isNestableDefinition),
    }
    if (!usage) return prefixTypeDefs(nestableDocument, prefix)
    // the Api type returns both root types
    const endpointUsage: Record<string, readonly string[]> = {Query: [], Mutation: []}
    Object.entries(usage).forEach(([typeName, fieldNames]) => {
      if (typeName.startsWith(prefix)) endpointUsage[typeName.slice(prefix.length)] = fieldNames
    })
    return prefixTypeDefs(pruneTypeDefs(nestableDocument, endpointUsage), prefix)
  }

  // only needed to transform a nested request, so the first one builds it
  let endpointSchema: GraphQLSchema | undefined
  const getEndpointSchema = () => {
    endpointSchema ??= buildSchema(schemaIDL, {assumeValidSDL: true})
    return endpointSchema
  }

  const resolveOperation =
    (isMutation?: boolean) =>
    async (
      source: NestedSource<TContext>,
      _args: any,
      executionRef: ExecutionRef,
      info: GraphQLResolveInfo,
    ) => {
      if (source.errors) return null
      const {context, wrapper, wrapperVars} = source
      const {dataLoaderOptions} = context
      let transform: ReturnType<typeof transformNestedSelection>
      try {
        const operationType = isMutation ? 'mutation' : 'query'
        transform = transformNestedSelection(
          getEndpointSchema(),
          info,
          prefix,
          operationType,
          wrapper,
        )
      } catch (e) {
        const errors = [{message: (e as Error).message || 'Transform error'}]
        if (source.resolveErrors) {
          source.resolveErrors(errors)
        } else {
          source.errors = errors
        }
        return null
      }
      const {document, variables, wrappedPath} = transform
      // Create a new dataloader for each execution (a context is created for each execution)
      const ghDataLoader = getRequestDataLoader(executionRef, dataLoaderOptions)
      const res = await ghDataLoader.load({
        document,
        variables: {...variables, ...wrapperVars},
        context,
        options: {
          batchKey,
          endpointTimeout,
          executor,
          prefix,
          isMutation: !!isMutation,
        },
      })
      if (source.resolveErrors) {
        source.resolveErrors(res.errors)
      } else {
        source.errors = res.errors
      }
      return wrappedPath
        ? wrappedPath.reduce((obj, prop) => obj?.[prop] ?? null, res.data as any)
        : res.data
    }

  const parentTypeDefs = `
      type ${prefix}ErrorLocation {
        line: Int!
        column: Int!
      }
      type ${prefix}Error {
        message: String!
        locations: [${prefix}ErrorLocation!]
        path: [String!]
      }
      type ${prefix}Api {
        errors: [${prefix}Error!]
        query: ${prefix}Query
        mutation: ${prefix}Mutation
      }
      extend type ${parentType} {
        ${fieldName}: ${prefix}Api
      }`

  const resolvers = {
    [parentType]: {
      [fieldName]: async (
        source: any,
        args: any,
        context: ExecutionRef,
        info: GraphQLResolveInfo,
      ) => {
        const {fieldNodes} = info
        const [fieldNode] = fieldNodes
        const {selectionSet} = fieldNode!
        const {selections} = selectionSet!
        const queryField = selections.find(
          (selection) => selection.kind === Kind.FIELD && selection.name.value === 'query',
        )
        const mutationField = selections.find(
          (selection) => selection.kind === Kind.FIELD && selection.name.value === 'mutation',
        )
        if (queryField && mutationField) {
          return {
            errors: [
              {
                message: 'Request can only include query or mutation',
              },
            ],
          }
        }
        if (!queryField && !mutationField) {
          return {
            errors: [
              {
                message: 'No query or mutation operation provided',
              },
            ],
          }
        }
        let endpointContext: TContext
        try {
          endpointContext = await resolveEndpointContext(source, args, context, info)
        } catch (e) {
          return {
            errors: [
              {
                message: (e as Error).message || 'No endpoint context provided',
              },
            ],
          }
        }
        return {context: endpointContext}
      },
    },
    [`${prefix}Api`]: {
      errors: (source: NestedSource<TContext>) => {
        // If an error was triggered before fetch, abort early
        if (source.errors) return source.errors
        // If a fetch is already in flight, re-use the same promise
        if (source.errorPromise) return source.errorPromise
        // If the endpoint returns errors, populate the errors field
        source.errorPromise = new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve([{message: `${prefix}: Resolution Timeout`}])
          }, endpointTimeout + 30)
          source.resolveErrors = (errors) => {
            clearTimeout(timeout)
            resolve(errors)
          }
        })
        return source.errorPromise
      },
      query: resolveOperation(),
      mutation: resolveOperation(true),
    },
  }

  const request = async <TData = any, TVars = any>(input: NestedRequestInput<TVars>) => {
    const {query, endpointContext, variables, batchRef, info} = input
    const api = info.schema.getType(`${prefix}Api`) as GraphQLObjectType
    const wrapper = parse(query)
    const {operation} = wrapper.definitions[0] as OperationDefinitionNode
    const rootOperation = api.getFields()[operation]
    if (!rootOperation) throw new Error(`Unsupported operation: ${operation}`)
    const source = {
      context: endpointContext,
      wrapper,
      wrapperVars: variables,
    } as NestedSource<any>
    const data = (await rootOperation.resolve!(source, {}, batchRef ?? {}, info)) as TData
    return {data, errors: source.errors}
  }

  return {prefix, getTypeDefs, getEndpointSchema, parentTypeDefs, resolvers, request}
}

export type {NestGraphQLEndpointsOptions} from './nestGraphQLEndpoints.ts'
export * from './types.ts'
export {
  findMissingNestedField,
  getNestedUsage,
  mergeNestedUsage,
  nestGraphQLEndpoint,
  nestGraphQLEndpoints,
  pruneTypeDefs,
}
export default nestGraphQLEndpoint
