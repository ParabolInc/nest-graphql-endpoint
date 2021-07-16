import {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  GraphQLResolveInfo,
  OperationDefinitionNode,
  visit
} from 'graphql'
import pruneInterfaces from './pruneInterfaces'
import {Variables} from './types'

// Transform the info fieldNodes into a standalone document AST
const transformInfoIntoDoc = (info: GraphQLResolveInfo) => {
  return {
    kind: 'Document',
    definitions: [
      {
        kind: info.operation.kind,
        operation: info.operation.operation,
        variableDefinitions: info.operation.variableDefinitions || [],
        selectionSet: {
          kind: 'SelectionSet',
          selections: info.fieldNodes.flatMap(({selectionSet}) => selectionSet!.selections),
        },
      },
      ...Object.values(info.fragments || {}),
    ],
  } as DocumentNode
}

// remove unused fragDefs, varDefs, and variables
const pruneUnused = (doc: DocumentNode, allVariables: Record<string, string>) => {
  const usedVariables = new Set<string>()
  const usedFragmentSpreads = new Set<string>()
  const {definitions} = doc
  const opDef = definitions.find(
    ({kind}) => kind === 'OperationDefinition',
  ) as OperationDefinitionNode

  visit(opDef.selectionSet, {
    Variable(node) {
      const {name} = node
      const {value} = name
      usedVariables.add(value)
    },
    FragmentSpread(node) {
      const {name} = node
      const {value} = name
      usedFragmentSpreads.add(value)
    },
  })

  const variableDefinitions = opDef.variableDefinitions || []
  const prunedOpDef = {
    ...opDef,
    variableDefinitions: variableDefinitions.filter((varDef) => {
      const {variable} = varDef
      const {name} = variable
      const {value} = name
      return usedVariables.has(value)
    }),
  }

  const prunedFragDefs = definitions.filter(
    (definition) =>
      definition.kind === 'FragmentDefinition' && usedFragmentSpreads.has(definition.name.value),
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

const MAGIC_FRAGMENT_NAME = 'info'

// if the request is coming in via a wrapper
// inject fieldNodes at the magic fragment spread
// record the path so the returned value ignores the wrapper
const mergeFieldNodesAndWrapper = (info: GraphQLResolveInfo, wrapper: DocumentNode) => {
  // TODO cache on wrapper input string
  const wrappedPath = [] as string[]
  const mergedDoc = visit(wrapper, {
    SelectionSet(node, _key, parent, _path, ancestors) {
      const {selections} = node
      const [firstSelection] = selections
      if (firstSelection.kind !== 'FragmentSpread') return undefined
      const {name} = firstSelection
      const {value} = name
      if (value !== MAGIC_FRAGMENT_NAME) return undefined
      if (wrappedPath.length) throw new Error(`Only one ...${MAGIC_FRAGMENT_NAME} is allowed`)
      ancestors.forEach((ancestor) => {
        if ('kind' in ancestor && ancestor.kind === 'Field') {
          const {name} = ancestor
          const {value} = name
          wrappedPath.push(value)
        }
      })
      wrappedPath.push((parent as FieldNode).name.value)
      return {
        kind: 'SelectionSet' as const,
        selections: info.fieldNodes.flatMap(({selectionSet}) => selectionSet!.selections),
      }
    },
  }) as DocumentNode

  // if magic fragment spread was not used, return early
  if (wrappedPath.length === 0) return {document: mergedDoc}

  // turn info into a doc
  const extraDefsDoc = transformInfoIntoDoc(info)
  const docs = [mergedDoc, extraDefsDoc]
  const opDefs = docs.map(
    ({definitions}) =>
      definitions.find(({kind}) => kind === 'OperationDefinition') as OperationDefinitionNode,
  )
  const fragDefs = docs.flatMap(
    ({definitions}) =>
      definitions.filter(({kind}) => kind === 'FragmentDefinition') as FragmentDefinitionNode[],
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
  info: GraphQLResolveInfo,
  prefix: string,
  wrapper?: DocumentNode,
) => {
  if (!wrapper) {
    const infoDoc = transformInfoIntoDoc(info)
    const {variables, document: prefixedDoc} = pruneUnused(infoDoc, info.variableValues)
    const document = unprefixTypes(prefixedDoc, prefix)
    return {document, variables, wrappedPath: undefined}
  }
  const {document: mergedDoc, wrappedPath} = mergeFieldNodesAndWrapper(info, wrapper)
  const localizedDoc = pruneInterfaces(mergedDoc, prefix, info)
  const {variables, document: prunedDoc} = pruneUnused(localizedDoc, info.variableValues)
  const document = unprefixTypes(prunedDoc, prefix)
  return {document, variables, wrappedPath}
}

export default transformNestedSelection
