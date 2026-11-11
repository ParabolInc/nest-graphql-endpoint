import {makeExecutableSchema} from '@graphql-tools/schema'
import {getResolversFromSchema} from '@graphql-tools/utils'
import {
  type DocumentNode,
  type GraphQLFieldResolver,
  type GraphQLSchema,
  isInterfaceType,
  isObjectType,
  Kind,
} from 'graphql'
import {mergeNestedUsage} from './getNestedUsage.ts'
import type {NestedEndpoint, NestedResolvers, NestedUsage} from './types.ts'

export interface NestGraphQLEndpointsOptions {
  // build only the nested types & fields these name, see getNestedUsage
  usage?: NestedUsage | null
  assumeValidSDL?: boolean
  updateResolversInPlace?: boolean
}

// if a field is aliased in the request that alias will be the key in the `source` object
const externalResolver: GraphQLFieldResolver<Record<string, unknown>, unknown> = (
  source,
  _args,
  _context,
  info,
) => {
  const key = info.fieldNodes[0]!.alias?.value ?? info.fieldName
  return source[key]
}

const getExternalResolvers = (endpointTypeDefs: DocumentNode) => {
  const resolvers: Record<string, Record<string, {resolve: typeof externalResolver}>> = {}
  endpointTypeDefs.definitions.forEach((definition) => {
    if (
      definition.kind !== Kind.OBJECT_TYPE_DEFINITION &&
      definition.kind !== Kind.OBJECT_TYPE_EXTENSION
    ) {
      return
    }
    const typeName = definition.name.value
    resolvers[typeName] ??= {}
    const fieldResolvers = resolvers[typeName]
    definition.fields?.forEach((field) => {
      fieldResolvers[field.name.value] = {resolve: externalResolver}
    })
  })
  return resolvers
}

// A nested type the parent schema gives its own interfaces needs those interfaces' fields
const getParentUsage = (parentSchema: GraphQLSchema, prefix: string) => {
  const usage: Record<string, string[]> = {}
  Object.values(parentSchema.getTypeMap()).forEach((type) => {
    if (!type.name.startsWith(prefix) || !(isObjectType(type) || isInterfaceType(type))) return
    usage[type.name] = type.getInterfaces().flatMap((iface) => Object.keys(iface.getFields()))
  })
  return usage
}

// Nesting every endpoint at once builds the merged schema once instead of once per endpoint
const nestGraphQLEndpoints = (
  parentSchema: GraphQLSchema,
  endpoints: readonly NestedEndpoint[],
  options: NestGraphQLEndpointsOptions = {},
) => {
  const {usage, ...buildOptions} = options
  const endpointTypeDefs = endpoints.map((endpoint) =>
    endpoint.getTypeDefs(
      usage ? mergeNestedUsage(usage, getParentUsage(parentSchema, endpoint.prefix)) : undefined,
    ),
  )
  const resolvers: NestedResolvers[] = endpoints.map((endpoint, idx) => ({
    ...getExternalResolvers(endpointTypeDefs[idx]!),
    ...endpoint.resolvers,
  }))
  return makeExecutableSchema({
    typeDefs: [
      ...[...endpointTypeDefs].reverse(),
      parentSchema,
      ...endpoints.map(({parentTypeDefs}) => parentTypeDefs),
    ],
    resolvers: [getResolversFromSchema(parentSchema), ...resolvers],
    ...buildOptions,
  })
}

export default nestGraphQLEndpoints
