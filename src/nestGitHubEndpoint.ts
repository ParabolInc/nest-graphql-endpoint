import {schema} from '@octokit/graphql-schema'
import {GraphQLObjectType, GraphQLResolveInfo, OperationDefinitionNode, parse, print} from 'graphql'
import fetch from 'node-fetch'
import nestGraphQLEndpoint from './nestGraphQLEndpoint'
import {EndpointExecutionResult, Executor, NestedSource, NestGraphQLEndpointParams} from './types'

const defaultExecutor: Executor<{accessToken: string; headers?: Record<string, string>}> = async (
  document,
  variables,
  endpointTimeout,
  context,
) => {
  const controller = new AbortController()
  const {signal} = controller
  const {accessToken, headers} = context
  const timeout = setTimeout(() => {
    controller.abort()
  }, endpointTimeout)
  try {
    const result = await fetch('https://api.github.com/graphql', {
      signal: signal as any,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        query: print(document),
        variables,
      }),
    })
    clearTimeout(timeout)
    const resJSON = (await result.json()) as EndpointExecutionResult | {message?: string}
    if ('data' in resJSON || 'errors' in resJSON) return resJSON
    const message = String(resJSON.message) || JSON.stringify(resJSON)
    return {
      errors: [
        {
          type: 'GitHub Gateway Error',
          message,
        },
      ],
      data: null,
    }
  } catch (e) {
    clearTimeout(timeout)
    return {
      errors: [
        {
          type: 'GitHub is down',
          message: String((e as any).message),
        },
      ],
      data: null,
    }
  }
}

type NestParams = NestGraphQLEndpointParams<{accessToken: string; headers?: Record<string, string>}>
type RequiredParams = Pick<
  NestParams,
  'parentSchema' | 'parentType' | 'fieldName' | 'resolveEndpointContext'
>

type OptionalParams = Omit<Partial<NestParams>, keyof RequiredParams>
type NestGitHubParams = RequiredParams & OptionalParams

interface Input<TVars> {
  query: string
  endpointContext: Record<string, any>
  info: GraphQLResolveInfo
  // only necessary if the query needs them
  variables?: TVars
  //to reuse a dataloader, pass in your execution context object
  batchRef?: Record<any, any>
}
const nestGitHubEndpoint = (params: NestGitHubParams) => {
  const {parentSchema, parentType, fieldName, resolveEndpointContext} = params
  const executor = params.executor || defaultExecutor
  const prefix = params.prefix || '_extGitHub'
  const batchKey = params.batchKey || 'accessToken'
  const endpointTimeout = params.endpointTimeout || 8000
  const schemaIDL = params.schemaIDL || schema.idl
  const githubRequest = async <TData = any, TVars = any>(input: Input<TVars>) => {
    const {query, endpointContext, variables, batchRef, info} = input
    const {schema} = info
    const githubApi = schema.getType(`${prefix}Api`) as GraphQLObjectType
    const fields = githubApi.getFields()
    const wrapperAST = parse(query)
    const {definitions} = wrapperAST
    const [firstDefinition] = definitions
    const {operation} = firstDefinition as OperationDefinitionNode
    const resolve = fields[operation].resolve!
    const source = {
      context: endpointContext,
      wrapper: wrapperAST,
      wrapperVars: variables,
    } as NestedSource<any>
    const context = batchRef ?? {}
    const data = (await resolve(source, {}, context, info)) as TData
    const {errors} = source
    return {data, errors}
  }

  const nestedSchema = nestGraphQLEndpoint({
    parentSchema,
    parentType,
    fieldName,
    resolveEndpointContext,
    executor,
    prefix,
    batchKey,
    endpointTimeout,
    schemaIDL,
  })

  return {schema: nestedSchema, githubRequest}
}

export default nestGitHubEndpoint
