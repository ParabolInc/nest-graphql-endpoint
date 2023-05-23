import {makeExecutableSchema, mergeSchemas} from '@graphql-tools/schema'
import {RenameRootTypes, RenameTypes, wrapSchema} from '@graphql-tools/wrap'
import {GraphQLObjectType, GraphQLResolveInfo, GraphQLSchema, Kind, isObjectType} from 'graphql'
import getRequestDataLoader from './getDataLoader'
import transformNestedSelection from './transformNestedSelection'
import {EndpointContext, ExecutionRef, NestedSource, NestGraphQLEndpointParams} from './types'

// if a field is aliased in the request that alias will be the key in the `source` object
const externalResolver = (
  source: any,
  _args: any,
  _context: ExecutionRef,
  info: GraphQLResolveInfo,
) => {
  const key = info.fieldNodes[0]!.alias?.value ?? info.fieldName
  return source[key]
}

const nestGraphQLEndpoint = <TContext extends EndpointContext>(
  params: NestGraphQLEndpointParams<TContext>,
) => {
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
  const schema = makeExecutableSchema({
    typeDefs: schemaIDL,
  })

  const transformedEndpointSchema = wrapSchema({
    schema,
    transforms: [new RenameRootTypes(prefixEndpoint), new RenameTypes(prefixEndpoint)],
  })
  // overwrite the resolves that wrapSchema added
  const typeMap = transformedEndpointSchema.getTypeMap()
  const isPublicObjectType = (type: any): type is GraphQLObjectType => {
    // private types include things like __Schema, __Type, __Directive
    // those already have their own resolvers that we do not want to overwrite
    return isObjectType(type) && !type.name.startsWith('__')
  }
  Object.values(typeMap)
    .filter(isPublicObjectType)
    .forEach((gqlObject) => {
      const fields = gqlObject.getFields()
      Object.values(fields).forEach((field) => {
        field.resolve = externalResolver
      })
    })

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
        transform = transformNestedSelection(schema, info, prefix, wrapper)
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
          let endpointContext
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
    },
  }) as GraphQLSchema
}

export default nestGraphQLEndpoint
