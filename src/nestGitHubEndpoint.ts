import {schema} from '@octokit/graphql-schema'
import AbortController from 'abort-controller'
import {print} from 'graphql'
import fetch from 'node-fetch'
import nestGraphQLEndpoint from './nestGraphQLEndpoint'
import {Executor, NestGraphQLEndpointParams} from './types'

const ENDPOINT_TIMEOUT = 8000
const executor: Executor<{accessToken: string}> = async (document, variables, context) => {
  const controller = new AbortController()
  const {signal} = controller
  const {accessToken} = context
  const timeout = setTimeout(() => {
    controller.abort()
  }, ENDPOINT_TIMEOUT)
  try {
    const result = await fetch('https://api.github.com/graphql', {
      signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: print(document),
        variables,
      }),
    })
    clearTimeout(timeout)
    const resJSON = await result.json()
    if (resJSON.data || resJSON.errors) return resJSON
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
          message: String(e.message),
        },
      ],
      data: null,
    }
  }
}

type NestGitHubParams = {prefix?: string} & Pick<
  NestGraphQLEndpointParams<{accessToken: string}>,
  'parentSchema' | 'parentType' | 'fieldName' | 'resolveEndpointContext'
>
const nestGitHubEndpoint = (params: NestGitHubParams) => {
  const {parentSchema, parentType, fieldName, resolveEndpointContext, prefix} = params
  return nestGraphQLEndpoint({
    parentSchema,
    parentType,
    fieldName,
    resolveEndpointContext,
    executor,
    prefix: prefix || '_extGitHub',
    batchKey: 'accessToken',
    endpointTimeout: ENDPOINT_TIMEOUT,
    schemaIDL: schema.idl,
  })
}
export default nestGitHubEndpoint
