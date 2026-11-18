import {
  type DefinitionNode,
  type DocumentNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type InlineFragmentNode,
  Kind,
  type OperationDefinitionNode,
  type SelectionNode,
  type SelectionSetNode,
  type VariableDefinitionNode,
} from 'graphql'
import aliasDocVariables_ from './aliasDocVariables_.ts'
import areArgsEqual from './areArgsEqual.ts'
import areDirectivesEqual from './areDirectivesEqual.ts'
import type {AliasMap, Variables} from './types.ts'

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

// Swaps each fragment spread for an inline fragment, so the fields of each request get response keys of their own.
// A fragment that applies wherever its parent does, like any at the root or one on its parent fragment's type, joins its parent.
// Fields & inline fragments are copied because merging changes their selections in place
const inlineFragments = (
  selections: readonly SelectionNode[],
  definitions: readonly DefinitionNode[],
  parentTypeCondition: string | undefined,
  isRoot: boolean,
): (FieldNode | InlineFragmentNode)[] =>
  selections.flatMap((selection) => {
    if (selection.kind === Kind.FIELD) {
      const {selectionSet} = selection
      if (!selectionSet) return [selection]
      const inlinedSelections = inlineFragments(
        selectionSet.selections,
        definitions,
        undefined,
        false,
      )
      return [{...selection, selectionSet: {...selectionSet, selections: inlinedSelections}}]
    }
    const {directives} = selection
    const {typeCondition, selectionSet} =
      selection.kind === Kind.INLINE_FRAGMENT
        ? selection
        : (definitions.find(
            (def) =>
              def.kind === Kind.FRAGMENT_DEFINITION && def.name.value === selection.name.value,
          ) as FragmentDefinitionNode)
    const typeName = typeCondition?.name.value
    if (!directives?.length && (isRoot || !typeName || typeName === parentTypeCondition)) {
      return inlineFragments(selectionSet.selections, definitions, parentTypeCondition, isRoot)
    }
    const childTypeCondition = typeName ?? parentTypeCondition
    const inlinedSelections = inlineFragments(
      selectionSet.selections,
      definitions,
      childTypeCondition,
      false,
    )
    return [
      {
        kind: Kind.INLINE_FRAGMENT,
        typeCondition,
        directives,
        selectionSet: {...selectionSet, selections: inlinedSelections},
      },
    ]
  })

const getMergedSelections = (
  baseSelections: readonly SelectionNode[],
  newSelections: readonly SelectionNode[],
  aliasMap: AliasMap,
  aliasIdx: number,
  isSuffixRequired: boolean,
  isMutation: boolean,
  isRoot: boolean,
) => {
  const nextSelections = [...baseSelections]
  const upsertFields = <T extends InlineFragmentNode | FieldNode>(
    existingSelection: T | undefined,
    newSelection: T,
    childAliasMap: AliasMap,
    isChildSuffixRequired: boolean,
  ) => {
    const base = existingSelection?.selectionSet?.selections ?? []
    // guaranteed to have a selectionSet if the existingSelection does
    const newSelectionSet = newSelection.selectionSet!
    const updatedSelections = getMergedSelections(
      base,
      newSelectionSet.selections,
      childAliasMap,
      aliasIdx,
      isChildSuffixRequired,
      false,
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
    // inlineFragments swapped every fragment spread for an inline fragment
    if (newSelection.kind === Kind.FRAGMENT_SPREAD) return
    if (newSelection.kind === Kind.INLINE_FRAGMENT) {
      // if there's an existing inline fragment with the type condition & directives
      // use that instead, just suffix all the fields
      const typeCondition = newSelection.typeCondition?.name.value
      const existingInlineFragment = nextSelections.find(
        (s) =>
          s.kind === Kind.INLINE_FRAGMENT &&
          s.typeCondition?.name.value === typeCondition &&
          areDirectivesEqual(s.directives, newSelection.directives),
      ) as InlineFragmentNode | undefined
      // Its fields land in its parent's response object, so they need a suffix wherever the parent's fields do.
      // The root suffixes a field only when its response key is taken, which a field inside an inline fragment can't check
      const isInsert = upsertFields(
        existingInlineFragment,
        newSelection,
        aliasMap,
        isSuffixRequired || isRoot || !!existingInlineFragment,
      )
      if (isInsert) {
        nextSelections.push(newSelection)
      }
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
            s.kind === Kind.FIELD &&
            s.name.value === newFieldName &&
            areArgsEqual(s.arguments, newFieldArgs) &&
            areDirectivesEqual(s.directives, newFieldDirectives),
        ) as FieldNode | undefined)

    let endpointResponseFieldName: string
    const isRequestedFieldNameFree = () => {
      return !nextSelections.find((s) => {
        return s.kind === Kind.FIELD && requestedFieldName === (s.alias?.value ?? s.name.value)
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
          kind: Kind.NAME,
          value: endpointResponseFieldName,
        },
      })
    }

    // one field can answer several of the request's response keys, so add to its entries
    // A response key selected again, e.g. directly & in a fragment, keeps the children it had
    aliasMap[endpointResponseFieldName] ??= []
    const aliasMapEntries = aliasMap[endpointResponseFieldName]
    let aliasMapEntry = aliasMapEntries.find((entry) => entry.name === requestedFieldName)
    if (!aliasMapEntry) {
      aliasMapEntry = {name: requestedFieldName, children: Object.create(null) as AliasMap}
      aliasMapEntries.push(aliasMapEntry)
    }
    if (!selectionSet) return
    // Recurse the child selections to suffix names & populate the entry's children
    // a suffix isn't required for children inside their own suffixed parent
    upsertFields(existingField, newSelection, aliasMapEntry.children, !!existingField)
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
    (curDef) => curDef.kind === Kind.OPERATION_DEFINITION && curDef.operation === operation,
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
    inlineFragments(selections, definitions, undefined, true),
    aliasMap,
    aliasIdx,
    false,
    isMutation,
    true,
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
      // fragment definitions aren't sent: inlineFragments copies them into the operation, with the request's own variables
      if (definition.kind === Kind.OPERATION_DEFINITION) {
        addNewOperationDefinition_(
          baseDefinitions,
          definition,
          definitions,
          aliasIdx,
          !!isMutation,
          aliasMap,
        )
      }
    })
    aliasMaps.push(aliasMap)
  })
  const mergedDoc = {
    kind: Kind.DOCUMENT as const,
    definitions: baseDefinitions,
  }
  return {document: mergedDoc, variables, aliasMaps}
}

export default mergeGQLDocuments
