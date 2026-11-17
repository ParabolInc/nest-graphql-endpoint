import assert from 'node:assert/strict'
import {test} from 'node:test'
import {addResolversToSchema} from '@graphql-tools/schema'
import {
  buildSchema,
  type DocumentNode,
  execute,
  type GraphQLResolveInfo,
  parse,
  print,
} from 'graphql'
import {
  type EndpointExecutionResult,
  nestGraphQLEndpoint,
  nestGraphQLEndpoints,
} from '../src/nestGraphQLEndpoint.ts'

const issue = {
  __typename: 'Issue',
  id: 'issue1',
  title: 'Ship the widget',
  state: {__typename: 'IssueState', name: 'Open'},
}

const buildTrackerSchema = (data: unknown) => {
  const sent: {document: string; variables: unknown}[] = []
  const endpoint = nestGraphQLEndpoint({
    parentType: 'Query',
    fieldName: 'api',
    prefix: '_xTracker',
    resolveEndpointContext: () => ({accessToken: 'tracker-token'}),
    schemaIDL: `
      type Query { issue(id: ID!): Issue }
      type Mutation { closeIssue(id: ID!): Issue }
      type Issue { id: ID! title: String body(format: String): String state: IssueState }
      type IssueState { name: String }
    `,
    executor: async (document: DocumentNode, variables): Promise<EndpointExecutionResult> => {
      sent.push({document: print(document), variables})
      return {data} as EndpointExecutionResult
    },
  })
  const nestedSchema = nestGraphQLEndpoints(
    buildSchema(`
      interface Integration { id: ID! }
      type JiraIssue implements Integration { id: ID! issueKey: String }
      type _xTrackerIssue implements Integration { id: ID! }
      type Task { integration: Integration }
      type Query { task: Task }
    `),
    [endpoint],
  )
  const schema = addResolversToSchema({
    schema: nestedSchema,
    resolvers: {
      ...endpoint.resolvers,
      Query: {...endpoint.resolvers.Query, task: () => ({})},
      Integration: {__resolveType: ({__typename}: {__typename: string}) => __typename},
      Task: {
        integration: async (_source, _args, context, info: GraphQLResolveInfo) => {
          const {data} = await endpoint.request({
            query: 'query { issue(id: "issue1") { ...info } }',
            endpointContext: {accessToken: 'tracker-token'},
            info,
            batchRef: context,
          })
          return data
        },
      },
    },
  })
  return {schema, sent}
}

test('a request through a wrapper sends fragments spread inside other fragments', async () => {
  const {schema, sent} = buildTrackerSchema({issue})
  const result = await execute({
    schema,
    contextValue: {},
    document: parse(`
      query {
        task {
          integration {
            __typename
            ...IntegrationLink
          }
        }
      }
      fragment IntegrationLink on Integration {
        id
        ...JiraLink
        ...TrackerLink
      }
      fragment JiraLink on JiraIssue {
        issueKey
      }
      fragment TrackerLink on _xTrackerIssue {
        title
        state {
          name
        }
      }
    `),
  })
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    data: {
      task: {
        integration: {
          __typename: '_xTrackerIssue',
          id: 'issue1',
          title: 'Ship the widget',
          state: {name: 'Open'},
        },
      },
    },
  })
  assert.equal(sent.length, 1)
  assert.match(sent[0]!.document, /fragment TrackerLink on Issue/)
  assert.doesNotMatch(sent[0]!.document, /JiraLink|issueKey/)
})

test('a direct query sends nested fragments and the variables only they use', async () => {
  const {schema, sent} = buildTrackerSchema({issue: {...issue, body: '**Ship**'}})
  const result = await execute({
    schema,
    contextValue: {},
    variableValues: {format: 'markdown', unused: 'nope'},
    document: parse(`
      query ($format: String, $unused: String) {
        api {
          query {
            issue(id: "issue1") {
              ...IssueFields
            }
          }
        }
      }
      fragment IssueFields on _xTrackerIssue {
        id
        ...IssueBody
      }
      fragment IssueBody on _xTrackerIssue {
        body(format: $format)
      }
    `),
  })
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    data: {api: {query: {issue: {id: 'issue1', body: '**Ship**'}}}},
  })
  assert.equal(sent.length, 1)
  assert.match(sent[0]!.document, /query \(\$format: String\)/)
  assert.match(sent[0]!.document, /fragment IssueBody on Issue/)
  assert.deepEqual({...(sent[0]!.variables as object)}, {format: 'markdown'})
})
