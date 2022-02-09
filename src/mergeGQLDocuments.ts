import {
  DefinitionNode,
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  print,
  SelectionNode,
  SelectionSetNode,
  VariableDefinitionNode,
  visit,
} from 'graphql'
import {AliasMapper, Variables} from './types'

interface MutableSelectionSetNode extends SelectionSetNode {
  selections: SelectionSetNode['selections'][0][]
}

interface BaseOperationDefinitionNode extends OperationDefinitionNode {
  variableDefinitions: NonNullable<OperationDefinitionNode['variableDefinitions']>[0][]
  selectionSet: MutableSelectionSetNode
}

interface CachedExecParams {
  document: DocumentNode
  variables: Variables
}

const addNewFragmentDefinition_ = (
  baseDefinitions: DefinitionNode[],
  definition: FragmentDefinitionNode,
) => {
  const {name} = definition
  const {value: definitionName} = name
  const baseFragmentNames = new Set<string>()
  baseDefinitions.forEach((definition) => {
    if (definition.kind === 'FragmentDefinition') {
      baseFragmentNames.add(definition.name.value)
    }
  })
  if (!baseFragmentNames.has(definitionName)) {
    baseDefinitions.push(definition)
  }
}

const getSelectionNamesAndAliases = (selections: SelectionNode[]) => {
  const usedNames = new Set<string>()
  selections.forEach((selection) => {
    if (selection.kind !== 'Field') return
    const key = selection.alias?.value ?? selection.name.value
    usedNames.add(key)
  })
  return usedNames
}

const gqlNodesAreEqual = (leftNode: FieldNode, rightNode: FieldNode) => {
  return print(leftNode) === print(rightNode)
}

const aliasFieldNode = (node: FieldNode, alias: string) => {
  return {
    ...node,
    alias: {
      kind: 'Name',
      value: alias,
    },
  } as FieldNode
}

const addNewVariableDefinitions_ = (
  baseVarDefs: VariableDefinitionNode[],
  variableDefinitions: VariableDefinitionNode[],
) => {
  variableDefinitions.forEach((curVarDef) => {
    const {variable} = curVarDef
    const {name} = variable
    const {value: varDefName} = name
    const isPresent = baseVarDefs.find((varDef) => varDef.variable.name.value === varDefName)
    if (!isPresent) {
      baseVarDefs.push(curVarDef)
    }
  })
}

const addNewSelections_ = (
  baseSelections: SelectionNode[],
  selections: SelectionNode[],
  aliasIdx: number,
  aliasMapper: AliasMapper,
  isMutation: boolean,
) => {
  selections.forEach((selection) => {
    if (selection.kind === 'InlineFragment') {
      // GQL engine will dedupe if there are multiple that are exactly the same
      baseSelections.push(selection)
      return
    }
    const {name} = selection
    const {value: selectionName} = name
    if (selection.kind === 'FragmentSpread') {
      // if it's a new fragment spread, add it, else ignore
      const existingFrag = baseSelections.find(
        (selection) =>
          selection.kind === 'FragmentSpread' && selection.name.value === selectionName,
      )
      if (!existingFrag) {
        baseSelections.push(selection)
      }
      return
    }

    // if it's a new field node, add it
    const existingField = baseSelections.find(
      (selection) => selection.kind === 'Field' && selection.name.value === selectionName,
    ) as FieldNode
    if (!existingField) {
      baseSelections.push(selection)
      return
    }

    // If this node is already present, don't include it again
    // Mutations are the exception. we want to run them all
    if (!isMutation && gqlNodesAreEqual(existingField, selection)) return

    // if the node has the same name but different children or arguments, alias it
    // there is some high hanging fruit where we could alias the children inside this
    const usedNames = getSelectionNamesAndAliases(baseSelections)
    let aliasedName = `${selectionName}_${aliasIdx}`
    while (usedNames.has(aliasedName)) {
      aliasedName = `${aliasedName}X`
    }
    const aliasedSelection = aliasFieldNode(selection, aliasedName)
    aliasMapper[aliasedName] = selection.alias?.value ?? selectionName
    baseSelections.push(aliasedSelection)
  })
}

const addNewOperationDefinition_ = (
  baseDefinitions: DefinitionNode[],
  definition: OperationDefinitionNode,
  aliasIdx: number,
  aliasMapper: AliasMapper,
  isMutation: boolean,
) => {
  const {operation, variableDefinitions, selectionSet} = definition as BaseOperationDefinitionNode
  // add completely new ops
  const matchingOp = baseDefinitions.find(
    (curDef) => curDef.kind === 'OperationDefinition' && curDef.operation === operation,
  ) as BaseOperationDefinitionNode
  if (!matchingOp) {
    baseDefinitions.push(definition)
    return
  }
  // merge var defs
  const {variableDefinitions: baseVarDefs, selectionSet: baseSelectionSet} = matchingOp
  const {selections: baseSelections} = baseSelectionSet
  addNewVariableDefinitions_(baseVarDefs, variableDefinitions)

  // merge selection set
  const {selections} = selectionSet
  addNewSelections_(baseSelections, selections, aliasIdx, aliasMapper, isMutation)
}

const aliasDocVariables_ = (
  execParams: CachedExecParams,
  aliasIdx: number,
  baseVariables: Variables,
) => {
  // mutates the baseVariables
  const {document, variables} = execParams
  const varDefMapper = {} as {
    [oldName: string]: string
  }
  Object.keys(variables).forEach((varName) => {
    const value = variables[varName]
    const baseValue = baseVariables[varName]
    if (baseValue === undefined) {
      baseVariables[varName] = value
    } else if (value !== baseValue) {
      // reuse a variable name with the same value
      const reusedEntry = Object.entries(baseVariables).find(
        ([existingValue]) => existingValue === value,
      )
      if (reusedEntry) {
        varDefMapper[varName] = reusedEntry[0]
      } else {
        let newVarName = `${varName}_${aliasIdx}`
        while (newVarName in baseVariables) {
          newVarName = `${newVarName}X`
        }
        // create a new variable name
        baseVariables[newVarName] = value
        // schedule that variable to be added to the varDefs
        varDefMapper[varName] = newVarName
      }
    }
  })
  if (Object.keys(varDefMapper).length === 0) return document
  return visit(document, {
    Variable: (node) => {
      const {name} = node
      const {value} = name
      if (value in varDefMapper) {
        return {
          ...node,
          name: {
            ...name,
            value: varDefMapper[value],
          },
        }
      }
      return undefined
    },
  }) as DocumentNode
}

const mergeGQLDocuments = (cachedExecParams: CachedExecParams[], isMutation?: boolean) => {
  if (cachedExecParams.length === 1) {
    return {
      ...cachedExecParams[0],
      aliasMappers: [{}] as AliasMapper[],
    }
  }
  const aliasMappers = [] as AliasMapper[]
  const baseDefinitions = [] as DefinitionNode[]
  const baseVariables = {} as Variables
  cachedExecParams.forEach((execParams, aliasIdx) => {
    const aliasMapper = {}
    const aliasedVarsDoc = aliasDocVariables_(execParams, aliasIdx, baseVariables)
    const {definitions} = aliasedVarsDoc

    definitions.forEach((definition) => {
      if (definition.kind === 'OperationDefinition') {
        addNewOperationDefinition_(baseDefinitions, definition, aliasIdx, aliasMapper, !!isMutation)
      } else if (definition.kind === 'FragmentDefinition') {
        addNewFragmentDefinition_(baseDefinitions, definition)
      }
    })
    aliasMappers.push(aliasMapper)
  })
  const mergedDoc = {
    kind: 'Document' as const,
    definitions: baseDefinitions,
  }
  return {document: mergedDoc, variables: baseVariables, aliasMappers}
}

export default mergeGQLDocuments
