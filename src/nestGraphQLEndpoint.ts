import {mergeSchemas} from '@graphql-tools/merge'
import {makeExecutableSchema} from '@graphql-tools/schema'
import {RenameRootTypes, RenameTypes, wrapSchema} from '@graphql-tools/wrap'
import {GraphQLResolveInfo, GraphQLSchema} from 'graphql'
import getRequestDataLoader from './getDataLoader'
import transformNestedSelection from './transformNestedSelection'
import {
  BaseGraphQLError,
  ExecutionRef,
  GraphQLEndpointError,
  NestGraphQLEndpointParams,
} from './types'

interface NestedSource<TContext> {
  context: TContext
  errors?: BaseGraphQLError[] | null
  errorPromise?: Promise<BaseGraphQLError[] | null | undefined>
  resolveErrors?: (errors: GraphQLEndpointError[] | null | undefined) => void
}

const nestGraphQLEndpoint = <TContext>(params: NestGraphQLEndpointParams<TContext>) => {
  const {
    parentSchema,
    parentType,
    fieldName,
    resolveEndpointContext,
    executor,
    schemaIDL,
    prefix,
    batchKey = 'accessToken',
    endpointTimeout = 10000,
  } = params
  const prefixEndpoint = (name: string) => `${prefix}${name}`
  const transformedEndpointSchema = wrapSchema({
    schema: makeExecutableSchema({
      typeDefs: schemaIDL,
    }),
    createProxyingResolver: () => (
      parent: any,
      _args: any,
      _context: ExecutionRef,
      info: GraphQLResolveInfo,
    ) => parent[info.fieldName],
    transforms: [new RenameRootTypes(prefixEndpoint), new RenameTypes(prefixEndpoint)],
  })

  const resolveOperation = (isMutation?: boolean) => async (
    source: NestedSource<TContext>,
    _args: any,
    executionRef: ExecutionRef,
    info: GraphQLResolveInfo,
  ) => {
    const {context} = source
    if (source.errors) return null
    const {document, variables} = transformNestedSelection(info, prefix)
    // Create a new dataloader for each execution (a context is created for each execution)
    const ghDataLoader = getRequestDataLoader(executionRef)
    const res = await ghDataLoader.load({
      document,
      variables,
      context,
      options: {
        batchKey,
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
    return res.data
  }

  return mergeSchemas({
    schemas: [transformedEndpointSchema, parentSchema],
    typeDefs: `
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
      }`,
    resolvers: {
      [parentType]: {
        [fieldName]: async (
          source: any,
          args: any,
          context: ExecutionRef,
          info: GraphQLResolveInfo,
        ) => {
          const {fieldNodes} = info
          const [fieldNode] = fieldNodes
          const {selectionSet} = fieldNode
          const {selections} = selectionSet!
          const queryField = selections.find(
            (selection) => selection.kind === 'Field' && selection.name.value === 'query',
          )
          const mutationField = selections.find(
            (selection) => selection.kind === 'Field' && selection.name.value === 'mutation',
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
          let endpointContext
          try {
            endpointContext = await resolveEndpointContext(source, args, context, info)
          } catch (e) {
            return {
              errors: [
                {
                  message: e?.message || 'No endpoint context provided',
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
    },
  }) as GraphQLSchema
}

export default nestGraphQLEndpoint
