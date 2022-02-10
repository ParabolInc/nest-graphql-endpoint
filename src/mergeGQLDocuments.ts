import {
  DefinitionNode,
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
  VariableDefinitionNode,
  visit,
} from 'graphql'
import areArgsEqual from './areArgsEqual'
import areDirectivesEqual from './areDirectivesEqual'
import {AliasMap, Variables} from './types'

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

const getMergedSelections = (
  baseSelections: readonly SelectionNode[],
  newSelections: readonly SelectionNode[],
  definitions: readonly DefinitionNode[],
  aliasMap: AliasMap,
  aliasIdx: number,
  isSuffixRequired: boolean,
  isMutation: boolean,
) => {
  const nextSelections = [...baseSelections]
  newSelections.forEach((newSelection) => {
    if (newSelection.kind === 'InlineFragment') {
      // GQL engine will dedupe if there are multiple that are exactly the same
      // we must prefix everything inside
      // the alternative is deeply traversing every other fragment & their fragments to ensure no name collisions
      const mergedInlineFragmentSelections = getMergedSelections(
        [],
        newSelection.selectionSet.selections,
        definitions,
        aliasMap,
        aliasIdx,
        true,
        false,
      )
      newSelection.selectionSet.selections = mergedInlineFragmentSelections
      nextSelections.push(newSelection)
      return
    }
    if (newSelection.kind === 'FragmentSpread') {
      // if it's a new fragment spread, add it, else ignore
      const matchingFrag = nextSelections.find(
        (s) => s.kind === 'FragmentSpread' && s.name.value === newSelection.name.value,
      )
      if (!matchingFrag) {
        nextSelections.push(newSelection)
      }
      const fragDef = definitions.find(
        (def) => def.kind === 'FragmentDefinition' && def.name.value === newSelection.name.value,
      ) as FragmentDefinitionNode
      const fragDefSelections = fragDef.selectionSet.selections
      // When new selections are equal to old selections, only aliasMap will be updated
      getMergedSelections(
        fragDefSelections,
        fragDefSelections,
        definitions,
        aliasMap,
        aliasIdx,
        true,
        false,
      )
      return
    }
    const {
      selectionSet,
      arguments: newFieldArgs,
      directives: newFieldDirectives,
      name,
      alias,
    } = newSelection
    const {value: newFieldName} = name
    const newFieldKey = alias?.value ?? newFieldName
    const matchingField = isMutation
      ? undefined
      : (nextSelections.find(
          (s) =>
            s.kind === 'Field' &&
            s.name.value === newFieldName &&
            areArgsEqual(s.arguments, newFieldArgs) &&
            areDirectivesEqual(s.directives, newFieldDirectives),
        ) as FieldNode | undefined)

    // map which fields are getting aliased
    const childAliasMap = Object.create(null) as AliasMap
    const nextKey = matchingField || !isSuffixRequired ? newFieldKey : `${newFieldKey}_${aliasIdx}`
    aliasMap[nextKey] = {
      name: newFieldKey,
      children: childAliasMap,
    }

    // Add the field if it doesn't exist
    if (!matchingField) {
      const nextField = isSuffixRequired
        ? {
            ...newSelection,
            alias: {
              kind: 'Name' as const,
              value: nextKey,
            },
          }
        : newSelection
      nextSelections.push(nextField)
    }

    // Recurse the child selections to prefix names & populate the childAliasMap
    if (selectionSet) {
      // matchingField.selectionSet is guaranteed to exist if selectionSet exists
      const base = matchingField ? matchingField.selectionSet!.selections : []
      const nextSelections = getMergedSelections(
        base,
        selectionSet.selections,
        definitions,
        childAliasMap,
        aliasIdx,
        // a suffix isn't required for children inside their own suffixed parent
        !!matchingField,
        false,
      )
      if (matchingField) {
        matchingField.selectionSet!.selections = nextSelections
      } else {
        selectionSet.selections = nextSelections
      }
    }
  })
  return nextSelections
}

const addNewOperationDefinition_ = (
  baseDefinitions: DefinitionNode[],
  definition: OperationDefinitionNode,
  definitions: readonly DefinitionNode[],
  aliasIdx: number,
  isMutation: boolean,
  aliasMap: AliasMap,
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
  baseSelectionSet.selections = getMergedSelections(
    baseSelections,
    selections,
    definitions,
    aliasMap,
    aliasIdx,
    false,
    isMutation,
  )
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
    const entryWithSameValue = Object.entries(baseVariables).find((entry) => entry[1] === value)
    if (entryWithSameValue) {
      varDefMapper[varName] = entryWithSameValue[0]
    } else {
      const suffixedVarName = varName in baseVariables ? `${varName}_${aliasIdx}` : varName
      baseVariables[suffixedVarName] = value
      varDefMapper[varName] = suffixedVarName
    }
  })
  const nameSort = (a: {name: {value: string}}, b: {name: {value: string}}) =>
    a.name.value < b.name.value ? -1 : 1
  const falsyOrEmpty = (node: readonly unknown[] | null | undefined) => !node || node.length === 0

  return visit(document, {
    Field: (node) => {
      // sort directives & args for easy equality checks later
      if (falsyOrEmpty(node.arguments) && falsyOrEmpty(node.directives)) return undefined
      return {
        ...node,
        directives: node.directives ? node.directives.slice().sort(nameSort) : node.directives,
        arguments: node.arguments ? node.arguments.slice().sort(nameSort) : node.arguments,
      }
    },
    Variable: (node) => {
      const {name} = node
      const value = varDefMapper[name.value]
      // TODO if the value is a short number or string, inline it
      return {
        ...node,
        name: {
          ...name,
          value,
        },
      }
    },
  }) as DocumentNode
}

const mergeGQLDocuments = (cachedExecParams: CachedExecParams[], isMutation?: boolean) => {
  const aliasMaps = [] as AliasMap[]
  if (cachedExecParams.length === 1) {
    return {
      ...cachedExecParams[0],
      aliasMaps,
    }
  }
  const baseDefinitions = [] as DefinitionNode[]
  const variables = Object.create(null) as Variables
  cachedExecParams.forEach((execParams, aliasIdx) => {
    const aliasedVarsDoc = aliasDocVariables_(execParams, aliasIdx, variables)
    const {definitions} = aliasedVarsDoc
    const aliasMap = Object.create(null) as AliasMap
    definitions.forEach((definition) => {
      if (definition.kind === 'OperationDefinition') {
        addNewOperationDefinition_(
          baseDefinitions,
          definition,
          definitions,
          aliasIdx,
          !!isMutation,
          aliasMap,
        )
      } else if (definition.kind === 'FragmentDefinition') {
        // Assumes similarly named fragments are identical
        // That means no alias necessary & we can reuse across the batch
        const fragmentName = definition.name.value
        const matchingFrag = baseDefinitions.find(
          (def) => def.kind === 'FragmentDefinition' && def.name.value === fragmentName,
        )
        if (!matchingFrag) {
          baseDefinitions.push(definition)
        }
      }
    })
    aliasMaps.push(aliasMap)
  })
  const mergedDoc = {
    kind: 'Document' as const,
    definitions: baseDefinitions,
  }
  return {document: mergedDoc, variables, aliasMaps}
}

export default mergeGQLDocuments
