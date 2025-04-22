import {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  GraphQLResolveInfo,
  GraphQLSchema,
  Kind,
  OperationDefinitionNode,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from 'graphql'
import pruneInterfaces from './pruneInterfaces'
import {Variables} from './types'

// Transform the info fieldNodes into a standalone document AST
const transformInfoIntoDoc = (info: GraphQLResolveInfo, operationType: 'query' | 'mutation') => {
  if (!operationType) {
    throw new Error('transformInfoIntoDoc requires an operationType parameter')
  }
  return {
    kind: Kind.DOCUMENT,
    definitions: [
      {
        kind: Kind.OPERATION_DEFINITION,
        operation: operationType,
        variableDefinitions: info.operation.variableDefinitions || [],
        selectionSet: {
          kind: Kind.SELECTION_SET,
          // probably a cleaner way to go about this...
          selections: JSON.parse(
            JSON.stringify(info.fieldNodes.flatMap(({selectionSet}) => selectionSet!.selections)),
          ),
        },
      },
      ...Object.values(info.fragments || {}),
    ],
  } as DocumentNode
}

// remove unused fragDefs, varDefs, and variables
const pruneUnused = (doc: DocumentNode, allVariables: GraphQLResolveInfo['variableValues']) => {
  const usedVariables = new Set<string>()
  const usedFragmentSpreads = new Set<string>()
  const {definitions} = doc
  const opDef = definitions.find(
    ({kind}) => kind === Kind.OPERATION_DEFINITION,
  ) as OperationDefinitionNode

  const nextSelectionSet = visit(opDef.selectionSet, {
    Variable(node) {
      const {name} = node
      const {value} = name
      usedVariables.add(value)
    },
    FragmentSpread(node) {
      const {name} = node
      const {value} = name
      const fragmentDefinition = definitions.find(
        (definition) =>
          definition.kind === Kind.FRAGMENT_DEFINITION && definition.name.value === value,
      )
      // the fragmentDefinition may have been removed by pruneLocalTypes
      if (!fragmentDefinition) return null
      usedFragmentSpreads.add(value)
      return undefined
    },
  })

  const variableDefinitions = opDef.variableDefinitions || []
  const prunedOpDef = {
    ...opDef,
    selectionSet: nextSelectionSet,
    variableDefinitions: variableDefinitions.filter((varDef) => {
      const {variable} = varDef
      const {name} = variable
      const {value} = name
      return usedVariables.has(value)
    }),
  }

  const prunedFragDefs = definitions.filter(
    (definition) =>
      definition.kind === Kind.FRAGMENT_DEFINITION &&
      usedFragmentSpreads.has(definition.name.value),
  ) as FragmentDefinitionNode[]

  const variables = {} as Variables
  usedVariables.forEach((variableName) => {
    variables[variableName] = allVariables[variableName]
  })

  return {
    variables,
    document: {
      ...doc,
      definitions: [prunedOpDef, ...prunedFragDefs],
    },
  }
}

const unprefixTypes = (document: DocumentNode, prefix: string) => {
  return visit(document, {
    NamedType(node) {
      const {name} = node
      const {value} = name
      return {
        ...node,
        name: {
          ...node.name,
          value: value.startsWith(prefix) ? value.slice(prefix.length) : value,
        },
      }
    },
  }) as DocumentNode
}

// If the nested schema was extended, those types can appear in the selection set but should not be sent to the endpoint
const pruneExtendedFields = (schema: GraphQLSchema, document: DocumentNode): DocumentNode => {
  const typeInfo = new TypeInfo(schema)
  return visit(
    document,
    visitWithTypeInfo(typeInfo, {
      Field() {
        return typeInfo.getFieldDef() ? undefined : null
      },
    }),
  )
}

const MAGIC_FRAGMENT_NAME = 'info'

// if the request is coming in via a wrapper
// inject fieldNodes at the magic fragment spread
// record the path so the returned value ignores the wrapper
const mergeFieldNodesAndWrapper = (fieldNodesDoc: DocumentNode, wrapper: DocumentNode) => {
  // TODO cache on wrapper input string
  const wrappedPath = [] as string[]
  const mergedDoc = visit(wrapper, {
    SelectionSet(node, _key, parent, _path, ancestors) {
      const {selections} = node
      const [firstSelection] = selections
      if (firstSelection.kind !== Kind.FRAGMENT_SPREAD) return undefined
      const {name} = firstSelection
      const {value} = name
      if (value !== MAGIC_FRAGMENT_NAME) return undefined
      if (wrappedPath.length) throw new Error(`Only one ...${MAGIC_FRAGMENT_NAME} is allowed`)
      ancestors.forEach((ancestor) => {
        if ('kind' in ancestor && ancestor.kind === Kind.FIELD) {
          const {name} = ancestor
          const {value} = name
          wrappedPath.push(value)
        }
      })
      wrappedPath.push((parent as FieldNode).name.value)
      const {definitions} = fieldNodesDoc
      const fieldNodesOpDef = definitions.find(
        (def) => def.kind === Kind.OPERATION_DEFINITION,
      ) as OperationDefinitionNode
      return fieldNodesOpDef.selectionSet
    },
  }) as DocumentNode

  // if magic fragment spread was not used, return early
  if (wrappedPath.length === 0) return {document: mergedDoc}

  const docs = [mergedDoc, fieldNodesDoc]
  const opDefs = docs.map(
    ({definitions}) =>
      definitions.find(({kind}) => kind === Kind.OPERATION_DEFINITION) as OperationDefinitionNode,
  )
  const fragDefs = docs.flatMap(
    ({definitions}) =>
      definitions.filter(({kind}) => kind === Kind.FRAGMENT_DEFINITION) as FragmentDefinitionNode[],
  )

  const [mergedOpDef] = opDefs

  const mergedDocAndDefs = {
    ...mergedDoc,
    definitions: [
      {
        ...mergedOpDef,
        variableDefinitions: opDefs.flatMap((op) => op.variableDefinitions || []),
      },
      ...fragDefs,
    ],
  } as DocumentNode
  return {wrappedPath, document: mergedDocAndDefs}
}

const transformNestedSelection = (
  schema: GraphQLSchema,
  info: GraphQLResolveInfo,
  prefix: string,
  operationType: 'query' | 'mutation',
  wrapper?: DocumentNode,
) => {
  if (!wrapper) {
    const infoDoc = transformInfoIntoDoc(info, operationType)
    const {variables, document: prefixedDoc} = pruneUnused(infoDoc, info.variableValues)
    const unprefixedDocument = unprefixTypes(prefixedDoc, prefix)
    const document = pruneExtendedFields(schema, unprefixedDocument)
    return {document, variables, wrappedPath: undefined}
  }
  const fieldNodesDoc = transformInfoIntoDoc(info, operationType)
  const fieldNodesWithoutLocalInterfacesDoc = pruneInterfaces(fieldNodesDoc, prefix, info)
  const unprefixedFieldNodesDoc = unprefixTypes(fieldNodesWithoutLocalInterfacesDoc, prefix)
  const {document: mergedDoc, wrappedPath} = mergeFieldNodesAndWrapper(
    unprefixedFieldNodesDoc,
    wrapper,
  )
  // pruneExtended must come after merging the wrapper into the document
  // because before that, the wrapper is an invalid operation living on the query instead
  // it must be moved to its correct location and then the TypeInfo will yield the correct result
  const fieldNodesWithoutExtendedFields = pruneExtendedFields(schema, mergedDoc)
  const {variables, document} = pruneUnused(fieldNodesWithoutExtendedFields, info.variableValues)
  return {document, variables, wrappedPath}
}

export default transformNestedSelection
