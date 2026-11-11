import {
  BREAK,
  type DocumentNode,
  type GraphQLSchema,
  isInterfaceType,
  isObjectType,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from 'graphql'
import type {NestedEndpoint, NestedUsage} from './types.ts'

// The nested types & fields that the documents select, so a schema can be built with only those
const getNestedUsage = (
  schema: GraphQLSchema,
  documents: readonly DocumentNode[],
  prefixes: readonly string[],
): NestedUsage => {
  const usage = new Map<string, Set<string>>()
  const use = (typeName: string, fieldName?: string) => {
    if (!prefixes.some((prefix) => typeName.startsWith(prefix))) return
    const fieldNames = usage.get(typeName) ?? new Set<string>()
    usage.set(typeName, fieldNames)
    if (fieldName && !fieldName.startsWith('__')) fieldNames.add(fieldName)
  }
  documents.forEach((document) => {
    const typeInfo = new TypeInfo(schema)
    visit(
      document,
      visitWithTypeInfo(typeInfo, {
        Field(node) {
          const parentType = typeInfo.getParentType()
          if (parentType && typeInfo.getFieldDef()) use(parentType.name, node.name.value)
        },
        InlineFragment(node) {
          if (node.typeCondition) use(node.typeCondition.name.value)
        },
        FragmentDefinition(node) {
          use(node.typeCondition.name.value)
        },
      }),
    )
  })
  return Object.fromEntries(
    [...usage.keys()].sort().map((typeName) => [typeName, [...usage.get(typeName)!].sort()]),
  )
}

type EndpointSchemaSource = Pick<NestedEndpoint, 'prefix' | 'getEndpointSchema'>

// The first nested type or field the document uses that the schema left out, e.g. to run it on a schema with every nested type.
// A field the endpoint doesn't have either is the document's mistake, not one the schema left out.
// Introspection describes the whole schema, so __schema and __type count as left out
export const findMissingNestedField = (
  schema: GraphQLSchema,
  document: DocumentNode,
  endpoints: readonly EndpointSchemaSource[],
) => {
  const getEndpointType = (typeName: string) => {
    const endpoint = endpoints.find(({prefix}) => typeName.startsWith(prefix))
    return endpoint?.getEndpointSchema().getType(typeName.slice(endpoint.prefix.length))
  }
  const typeInfo = new TypeInfo(schema)
  let missing: string | undefined
  const checkType = (typeName: string) => {
    if (schema.getType(typeName) || !getEndpointType(typeName)) return undefined
    missing = typeName
    return BREAK
  }
  visit(
    document,
    visitWithTypeInfo(typeInfo, {
      Field(node) {
        const parentType = typeInfo.getParentType()
        const fieldName = node.name.value
        if (fieldName === '__schema' || fieldName === '__type') {
          missing = fieldName
          return BREAK
        }
        if (!parentType || fieldName.startsWith('__') || typeInfo.getFieldDef()) return undefined
        const endpointType = getEndpointType(parentType.name)
        const hasField =
          (isObjectType(endpointType) || isInterfaceType(endpointType)) &&
          fieldName in endpointType.getFields()
        if (!hasField) return undefined
        missing = `${parentType.name}.${fieldName}`
        return BREAK
      },
      InlineFragment(node) {
        return node.typeCondition ? checkType(node.typeCondition.name.value) : undefined
      },
      FragmentDefinition(node) {
        return checkType(node.typeCondition.name.value)
      },
    }),
  )
  return missing
}

export const mergeNestedUsage = (...usages: NestedUsage[]): NestedUsage => {
  const merged = new Map<string, Set<string>>()
  usages.forEach((usage) => {
    Object.entries(usage).forEach(([typeName, fieldNames]) => {
      merged.set(typeName, new Set([...(merged.get(typeName) ?? []), ...fieldNames]))
    })
  })
  return Object.fromEntries(
    [...merged].map(([typeName, fieldNames]) => [typeName, [...fieldNames]]),
  )
}

export default getNestedUsage
