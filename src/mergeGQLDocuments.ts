import {
  DefinitionNode,
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
  VariableDefinitionNode,
} from 'graphql'
import aliasDocVariables_ from './aliasDocVariables_'
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
    const isNameConflict = baseVarDefs.find((varDef) => varDef.variable.name.value === varDefName)
    if (!isNameConflict) {
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
  const upsertFields = <T extends InlineFragmentNode | FieldNode>(
    existingSelection: T | undefined,
    newSelection: T,
    childAliasMap: AliasMap,
  ) => {
    const base = existingSelection?.selectionSet?.selections ?? []
    // guaranteed to have a selectionSet if the existingSelection does
    const newSelectionSet = newSelection.selectionSet!
    const updatedSelections = getMergedSelections(
      base,
      newSelectionSet.selections,
      definitions,
      childAliasMap,
      aliasIdx,
      // a suffix isn't required for children inside their own suffixed parent
      !!existingSelection,
      false,
    )
    if (existingSelection) {
      existingSelection.selectionSet!.selections = updatedSelections
      return false
    }
    newSelectionSet.selections = updatedSelections
    return true
  }
  newSelections.forEach((newSelection) => {
    if (newSelection.kind === 'InlineFragment') {
      // if there's an existing inline fragment with the type condition & directives
      // use that instead, just suffix all the fields
      const typeCondition = newSelection.typeCondition?.name.value
      const existingInlineFragment = nextSelections.find(
        (s) =>
          s.kind === 'InlineFragment' &&
          s.typeCondition?.name.value === typeCondition &&
          areDirectivesEqual(s.directives, newSelection.directives),
      ) as InlineFragmentNode | undefined
      const isInsert = upsertFields(existingInlineFragment, newSelection, aliasMap)
      if (isInsert) {
        nextSelections.push(newSelection)
      }
      return
    }
    if (newSelection.kind === 'FragmentSpread') {
      // if it's a new fragment spread, add it, else ignore
      const existingFrag = nextSelections.find(
        (s) => s.kind === 'FragmentSpread' && s.name.value === newSelection.name.value,
      )
      if (!existingFrag) {
        nextSelections.push(newSelection)
      }
      const fragDef = definitions.find(
        (def) => def.kind === 'FragmentDefinition' && def.name.value === newSelection.name.value,
      ) as FragmentDefinitionNode
      const fragDefSelections = fragDef.selectionSet.selections
      // Update the aliasMap by traversing the children
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
    const isInternal = newFieldName.startsWith('__')
    // If the client aliased a field, the response will use that alias
    // If the response is to be used as the source in a resolve function, you must resolve to the alias
    // E.g. source[info.fieldNodes[0].alias?.value ?? info.fieldName]
    const requestedFieldName = alias?.value ?? newFieldName
    const existingField = isMutation
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
    let endpointResponseFieldName: string
    const isRequestedFieldNameFree = () => {
      return !nextSelections.find((s) => {
        return s.kind === 'Field' && requestedFieldName === (s.alias?.value ?? s.name.value)
      })
    }
    if (existingField) {
      // reuse the existing field (add our own child selections to it later)
      endpointResponseFieldName = existingField.alias?.value ?? existingField.name.value
    } else if (isInternal || (!isSuffixRequired && isRequestedFieldNameFree())) {
      // there's no existing field, so we're going to add a new one
      // that new one doesn't need a suffix because this execution created the parent node
      // Unless some other field has the same name as the one we're trying to add
      // or .e.g. __typename field never needs a suffix since it'll always be a String!
      endpointResponseFieldName = requestedFieldName
      nextSelections.push(newSelection)
    } else {
      // suffix this because we're in the parent of another execution
      endpointResponseFieldName = `${requestedFieldName}_${aliasIdx}`
      nextSelections.push({
        ...newSelection,
        alias: {
          kind: 'Name' as const,
          value: endpointResponseFieldName,
        },
      })
    }

    aliasMap[endpointResponseFieldName] = {
      name: requestedFieldName,
      children: childAliasMap,
    }
    if (!selectionSet) return
    // Recurse the child selections to suffix names & populate the childAliasMap
    upsertFields(existingField, newSelection, childAliasMap)
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
  let matchingOp = baseDefinitions.find(
    (curDef) => curDef.kind === 'OperationDefinition' && curDef.operation === operation,
  )
  // create an empty version so the first execParams can crawl & map
  if (!matchingOp) {
    matchingOp = {
      ...definition,
      selectionSet: {
        ...definition.selectionSet,
        selections: [],
      },
    }
    baseDefinitions.push(matchingOp)
  }
  // merge var defs
  const {variableDefinitions: baseVarDefs, selectionSet: baseSelectionSet} =
    matchingOp as BaseOperationDefinitionNode
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

const mergeGQLDocuments = (cachedExecParams: CachedExecParams[], isMutation?: boolean) => {
  const aliasMaps = [] as AliasMap[]
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
        const existingFrag = baseDefinitions.find(
          (def) => def.kind === 'FragmentDefinition' && def.name.value === fragmentName,
        )
        if (!existingFrag) {
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
