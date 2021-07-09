import {
  DefinitionNode,
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  GraphQLResolveInfo,
  OperationDefinitionNode,
  visit
} from 'graphql'
import pruneLocalTypes from './pruneLocalTypes'
import {Variables} from './types'

const pruneUnusedNodes = (info: GraphQLResolveInfo) => {
  const usedVariables = new Set<string>()
  const usedFragmentSpreads = new Set<string>()
  const fragmentDefinitions = [] as FragmentDefinitionNode[]
  const querySelectionSet = {
    kind: 'SelectionSet' as const,
    selections: info.fieldNodes.flatMap(({selectionSet}) => selectionSet!.selections),
  }
  const variableDefinitions = info.operation.variableDefinitions || []
  const fragments = info.fragments || {}
  const allVariables = info.variableValues || {}

  visit(querySelectionSet, {
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

  const prunedVariableDefinitions = variableDefinitions.filter((varDef) => {
    const {variable} = varDef
    const {name} = variable
    const {value} = name
    return usedVariables.has(value)
  })
  Object.keys(fragments).forEach((fragmentName) => {
    if (usedFragmentSpreads.has(fragmentName)) {
      fragmentDefinitions.push(fragments[fragmentName])
    }
  })

  const variables = {} as Variables
  usedVariables.forEach((variableName) => {
    variables[variableName] = allVariables[variableName]
  })

  return {
    variables,
    document: {
      kind: 'Document' as const,
      definitions: [
        {
          kind: info.operation.kind,
          operation: info.operation.operation,
          variableDefinitions: prunedVariableDefinitions,
          selectionSet: querySelectionSet,
        },
        ...fragmentDefinitions,
      ],
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

// if the request is coming in via another type
// remove local types & fragments
// insert the fragment into the user-defined wrapper at the point of `...info`
// and when the value returns, remove the wrapper
const delocalizeDoc = (
  doc: DocumentNode,
  prefix: string,
  info: GraphQLResolveInfo,
  wrapper?: DocumentNode,
) => {
  if (!wrapper) return {document: doc}
  const delocalizedDoc = pruneLocalTypes(doc, prefix, info)
  const {definitions} = delocalizedDoc
  const firstDefinition = definitions[0] as OperationDefinitionNode

  // TODO include wrapper + variables so we can cache this
  const {definitions: wrapperDefs} = wrapper
  const [wrappedDefinition] = wrapperDefs
  const wrappedPath = [] as string[]
  const joinedAST = visit(wrappedDefinition, {
    SelectionSet(node, _key, parent, _path, ancestors) {
      const {selections} = node
      const [firstSelection] = selections
      if (firstSelection.kind !== 'FragmentSpread') return undefined
      const {name} = firstSelection
      const {value} = name
      if (value !== MAGIC_FRAGMENT_NAME) return undefined
      ancestors.forEach((ancestor) => {
        if ('kind' in ancestor && ancestor.kind === 'Field') {
          const {name} = ancestor
          const {value} = name
          wrappedPath.push(value)
        }
      })
      wrappedPath.push((parent as FieldNode).name.value)
      return firstDefinition.selectionSet
    },
  }) as DefinitionNode

  return {
    wrappedPath,
    document: {
      ...delocalizedDoc,
      definitions: [joinedAST, ...definitions.slice(1)],
    },
  }
}

const transformNestedSelection = (
  info: GraphQLResolveInfo,
  prefix: string,
  wrapper?: DocumentNode,
) => {
  const {variables, document: prefixedDoc} = pruneUnusedNodes(info)
  const {document: delocalizedDoc, wrappedPath} = delocalizeDoc(prefixedDoc, prefix, info, wrapper)
  const document = unprefixTypes(delocalizedDoc, prefix)
  return {document, variables, wrappedPath}
}

export default transformNestedSelection
