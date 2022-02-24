import {DocumentNode} from 'graphql'
import dealiasResult from './dealiasResult'
import filterErrorsForDocument from './filterErrorsForDocument'
import mergeGQLDocuments from './mergeGQLDocuments'
import renameResponseTypenames_ from './renameResponseTypenames_'
import {DataLoaderKey, EndpointExecutionResult, Variables} from './types'
import wrapExecutor from './wrapExecutor'

interface BatchedExecParams<TContext> {
  document: DocumentNode
  variables: Variables
  context: TContext
  idx: number
}
interface ExecParamsByToken<TContext> {
  [accessToken: string]: BatchedExecParams<TContext>[]
}

const batchFn = async <TContext extends Record<string, any>>(
  keys: readonly DataLoaderKey<TContext>[],
) => {
  const [firstKey] = keys
  const {options} = firstKey
  const {batchKey, endpointTimeout, executor, isMutation, prefix} = options
  const wrappedExecutor = wrapExecutor(executor)
  const execParamsByToken = keys.reduce((obj, key, idx) => {
    const {context} = key
    const accessToken = context[batchKey]
    if (typeof accessToken !== 'string') {
      throw new Error('Access token not provided')
    }
    if (!accessToken) return obj
    obj[accessToken] = obj[accessToken] || []
    obj[accessToken].push({
      document: key.document,
      variables: key.variables,
      context,
      idx,
    })
    return obj
  }, {} as ExecParamsByToken<TContext>)

  const results = [] as EndpointExecutionResult[]
  await Promise.all(
    Object.values(execParamsByToken).map(async (execParams) => {
      const [firstParam] = execParams
      // context is per-fetch
      const {context} = firstParam
      const {document, variables, aliasMaps} = mergeGQLDocuments(execParams, isMutation)
      const result = await wrappedExecutor(document, variables, endpointTimeout, context)
      renameResponseTypenames_(result.data, prefix, aliasMaps)
      const {errors, data} = result
      execParams.forEach((execParam, idx) => {
        const aliasMap = aliasMaps[idx]
        const {idx: resultsIdx, document} = execParam
        results[resultsIdx] = {
          data: dealiasResult(data, aliasMap),
          errors: filterErrorsForDocument(document, errors),
        }
      })
    }),
  )
  return results
}

export default batchFn
