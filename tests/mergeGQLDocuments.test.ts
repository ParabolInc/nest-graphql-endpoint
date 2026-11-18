import assert from 'node:assert/strict'
import {test} from 'node:test'
import {buildSchema, execute, parse, print, validate} from 'graphql'
import batchFn from '../src/batchFn.ts'
import dealiasResult from '../src/dealiasResult.ts'
import mergeGQLDocuments from '../src/mergeGQLDocuments.ts'
import type {EndpointExecutionResult, Executor, Variables} from '../src/types.ts'

test('merges documents and splits the response back into each one', () => {
  const q1 =
    `query getIssueLabels($repoName: String!, $repoOwner: String!, $issueNumber: Int!, $first: Int!) {
  rateLimit {
    cost
  }
  repository(name: $repoName, owner: $repoOwner) {
    issue(number: $issueNumber) {
      id
      labels(first: $first) {
        nodes {
          id
          name
          pullRequests(first:100) {
            nodes {
              id
            }
          }
        }
      }
    }
  }
}`.trim()

  const q2 =
    `query getIssueLabels($repoName: String!, $repoOwner: String!, $issueNumber: Int!, $first: Int!) {
  rateLimit {
    cost
  }
  repository(name: $repoName, owner: $repoOwner) {
    issue(number: $issueNumber) {
      id
      labels(first: $first) {
        nodes {
          id
          name
          pullRequests(last:100) {
            nodes {
              id
              __typename
            }
          }
        }
      }
    }
  }
}`.trim()

  const q1q2Merged =
    `query getIssueLabels($repoName: String!, $repoOwner: String!, $issueNumber: Int!, $first: Int!) {
  rateLimit {
    cost
  }
  repository(name: $repoName, owner: $repoOwner) {
    issue(number: $issueNumber) {
      id
      labels(first: $first) {
        nodes {
          id
          name
          pullRequests(first: 100) {
            nodes {
              id
            }
          }
          pullRequests_1: pullRequests(last: 100) {
            nodes {
              id
              __typename
            }
          }
        }
      }
    }
  }
}`.trim()
  const q1q2Response = {
    data: {
      rateLimit: {
        cost: 1,
      },
      repository: {
        issue: {
          id: 'I_kwDOAuJJ2c5DNWQC',
          labels: {
            nodes: [
              {
                id: 'MDU6TGFiZWwzMDIzNDA5MzU=',
                name: 'bug',
                pullRequests: {
                  nodes: [
                    {
                      id: 'MDExOlB1bGxSZXF1ZXN0MTM1NzE1NzE1',
                    },
                    {
                      id: 'MDExOlB1bGxSZXF1ZXN0NTc1Mjc4NDg3',
                    },
                    {
                      id: 'MDExOlB1bGxSZXF1ZXN0Njg4MTQ1NTM2',
                    },
                    {
                      id: 'PR_kwDOAuJJ2c4wGI-3',
                    },
                  ],
                },
                pullRequests_1: {
                  nodes: [
                    {
                      id: 'MDExOlB1bGxSZXF1ZXN0MTM1NzE1NzE1',
                      __typename: 'PullRequest',
                    },
                    {
                      id: 'MDExOlB1bGxSZXF1ZXN0NTc1Mjc4NDg3',
                      __typename: 'PullRequest',
                    },
                    {
                      id: 'MDExOlB1bGxSZXF1ZXN0Njg4MTQ1NTM2',
                      __typename: 'PullRequest',
                    },
                    {
                      id: 'PR_kwDOAuJJ2c4wGI-3',
                      __typename: 'PullRequest',
                    },
                  ],
                },
              },
              {
                id: 'MDU6TGFiZWwyODkwMTk5ODgx',
                name: 'p1',
                pullRequests: {
                  nodes: [],
                },
                pullRequests_1: {
                  nodes: [],
                },
              },
              {
                id: 'LA_kwDOAuJJ2c7iPAj4',
                name: 'Story Points: 1',
                pullRequests: {
                  nodes: [],
                },
                pullRequests_1: {
                  nodes: [],
                },
              },
            ],
          },
        },
      },
    },
  }

  const q1Response = {
    data: {
      rateLimit: {
        cost: 1,
      },
      repository: {
        issue: {
          id: 'I_kwDOAuJJ2c5DNWQC',
          labels: {
            nodes: [
              {
                id: 'MDU6TGFiZWwzMDIzNDA5MzU=',
                name: 'bug',
                pullRequests: {
                  nodes: [
                    {
                      id: 'MDExOlB1bGxSZXF1ZXN0MTM1NzE1NzE1',
                    },
                    {
                      id: 'MDExOlB1bGxSZXF1ZXN0NTc1Mjc4NDg3',
                    },
                    {
                      id: 'MDExOlB1bGxSZXF1ZXN0Njg4MTQ1NTM2',
                    },
                    {
                      id: 'PR_kwDOAuJJ2c4wGI-3',
                    },
                  ],
                },
              },
              {
                id: 'MDU6TGFiZWwyODkwMTk5ODgx',
                name: 'p1',
                pullRequests: {
                  nodes: [],
                },
              },
              {
                id: 'LA_kwDOAuJJ2c7iPAj4',
                name: 'Story Points: 1',
                pullRequests: {
                  nodes: [],
                },
              },
            ],
          },
        },
      },
    },
    errors: null,
  }

  const q2Response = {
    data: {
      rateLimit: {
        cost: 1,
      },
      repository: {
        issue: {
          id: 'I_kwDOAuJJ2c5DNWQC',
          labels: {
            nodes: [
              {
                id: 'MDU6TGFiZWwzMDIzNDA5MzU=',
                name: 'bug',
                pullRequests: {
                  nodes: [
                    {
                      id: 'MDExOlB1bGxSZXF1ZXN0MTM1NzE1NzE1',
                      __typename: 'PullRequest',
                    },
                    {
                      id: 'MDExOlB1bGxSZXF1ZXN0NTc1Mjc4NDg3',
                      __typename: 'PullRequest',
                    },
                    {
                      id: 'MDExOlB1bGxSZXF1ZXN0Njg4MTQ1NTM2',
                      __typename: 'PullRequest',
                    },
                    {
                      id: 'PR_kwDOAuJJ2c4wGI-3',
                      __typename: 'PullRequest',
                    },
                  ],
                },
              },
              {
                id: 'MDU6TGFiZWwyODkwMTk5ODgx',
                name: 'p1',
                pullRequests: {
                  nodes: [],
                },
              },
              {
                id: 'LA_kwDOAuJJ2c7iPAj4',
                name: 'Story Points: 1',
                pullRequests: {
                  nodes: [],
                },
              },
            ],
          },
        },
      },
    },
    errors: null,
  }

  const d1 = parse(q1)
  const d2 = parse(q2)
  const variables = {
    repoName: 'repoName',
    repoOwner: 'repoOwner',
    first: 100,
    issueNumber: 3,
  }
  const execParams = [
    {
      document: d1,
      variables,
      idx: 0,
    },
    {
      document: d2,
      variables,
      idx: 1,
    },
  ]
  const {document, aliasMaps} = mergeGQLDocuments(execParams)
  const docStr = print(document)
  assert.equal(docStr, q1q2Merged)
  const results = [] as Record<number, {data: any; errors: any}>
  execParams.forEach((_execParam, idx) => {
    const batchPath = aliasMaps[idx]
    results[idx] = {
      data: dealiasResult(q1q2Response.data, batchPath),
      errors: null,
    }
  })
  assert.deepEqual(results[0], q1Response)
  assert.deepEqual(results[1], q2Response)
})

const mergedQuery = `{
  repository(name: "parabol", owner: "ParabolInc") {
    issue(number: 5821) {
      __typename
      ... on Issue {
        __typename
        title
        number
        repository_0: repository {
          nameWithOwner
          id
        }
        bodyHTML_0: bodyHTML
        ghUrl_0: url
      }
      id
    }
    issue_1: issue(number: 5811) {
      __typename
      ... on Issue {
        __typename
        title
        number
        repository_1: repository {
          nameWithOwner
          id
        }
        bodyHTML_1: bodyHTML
        ghUrl_1: url
      }
      id
    }
    issue_2: issue(number: 58112) {
      __typename
      ... on Issue {
        __typename
        title
        number
        repository_2: repository {
          nameWithOwner
          id
        }
        bodyHTML_2: bodyHTML
        ghUrl_2: url
      }
      id
    }
  }
}`

test('aliases the fields that conflict across documents', () => {
  const q1 = `{
  repository(owner: "ParabolInc", name: "parabol") {
    issue(number: 5821) {
      __typename
      ... on Issue {
        __typename
        title
        number
      }
      id
      __typename
      id
      __typename
      id
      __typename
      ... on Issue {
        __typename
        repository {
          nameWithOwner
          id
        }
      }
      id
      __typename
      id
      __typename
      ... on Issue {
        __typename
        ...PokerEstimateHeaderCardGitHub_issue
      }
      id
    }
  }
}

fragment PokerEstimateHeaderCardGitHub_issue on Issue {
  number
  title
  bodyHTML
  ghUrl: url
}`

  const q2 = `{
  repository(owner: "ParabolInc", name: "parabol") {
    issue(number: 5811) {
      __typename
      ... on Issue {
        __typename
        title
        number
      }
      id
      __typename
      id
      __typename
      id
      __typename
      ... on Issue {
        __typename
        repository {
          nameWithOwner
          id
        }
      }
      id
      __typename
      id
      __typename
      ... on Issue {
        __typename
        ...PokerEstimateHeaderCardGitHub_issue
      }
      id
    }
  }
}

fragment PokerEstimateHeaderCardGitHub_issue on Issue {
  number
  title
  bodyHTML
  ghUrl: url
}`

  const q3 = `{
  repository(owner: "ParabolInc", name: "parabol") {
    issue(number: 58112) {
      __typename
      ... on Issue {
        __typename
        title
        number
      }
      id
      __typename
      id
      __typename
      id
      __typename
      ... on Issue {
        __typename
        repository {
          nameWithOwner
          id
        }
      }
      id
      __typename
      id
      __typename
      ... on Issue {
        __typename
        ...PokerEstimateHeaderCardGitHub_issue
      }
      id
    }
  }
}

fragment PokerEstimateHeaderCardGitHub_issue on Issue {
  number
  title
  bodyHTML
  ghUrl: url
}`
  const d1 = parse(q1)
  const d2 = parse(q2)
  const d3 = parse(q3)
  const variables = {}
  const execParams = [
    {
      document: d1,
      variables,
      idx: 0,
    },
    {
      document: d2,
      variables,
      idx: 1,
    },
    {
      document: d3,
      variables,
      idx: 2,
    },
  ]
  const {document} = mergeGQLDocuments(execParams)
  assert.equal(print(document), mergedQuery)
})

const trackerSchema = buildSchema(`
  type Query { issue(id: ID!): Issue }
  type Issue { id: ID! title: String! assignee: User labels: [Label] }
  type User { id: ID! name: String! }
  type Label { name: String! }
`)

const issuesById: Record<string, unknown> = {
  issue1: {
    id: 'issue1',
    title: 'Ship the widget',
    assignee: {id: 'user1', name: 'Ada'},
    labels: [{name: 'bug'}, null],
  },
  issue2: {id: 'issue2', title: 'Fix the gadget', assignee: null, labels: []},
}
const trackerData = {issue: ({id}: {id: string}) => issuesById[id]}

// runs the merged document against a real schema, so the response has the keys an endpoint would send
const batchTrackerRequests = async (queries: string[], variables: Variables[] = []) => {
  const sent: string[] = []
  const executor: Executor<{accessToken: string}> = async (document, variables) => {
    sent.push(print(document))
    const validationErrors = validate(trackerSchema, document)
    if (validationErrors.length > 0) {
      return {data: null, errors: validationErrors.map(({message}) => ({message}))}
    }
    const result = await execute({
      schema: trackerSchema,
      document,
      variableValues: variables,
      rootValue: trackerData,
    })
    return result as EndpointExecutionResult
  }
  const results = await batchFn(
    queries.map((query, idx) => ({
      document: parse(query),
      variables: variables[idx] ?? {},
      context: {accessToken: 'tracker-token'},
      options: {
        batchKey: 'accessToken',
        endpointTimeout: 1000,
        executor,
        prefix: '_xTracker',
        isMutation: false,
      },
    })),
  )
  assert.deepEqual(
    results.flatMap((result) => result.errors ?? []),
    [],
  )
  return {data: results.map((result) => result.data), sent}
}

test('returns each response key a request selects one field under', async () => {
  const {data, sent} = await batchTrackerRequests([
    '{ issue(id: "issue1") { title shortTitle: title } }',
    '{ issue(id: "issue1") { shortTitle: title } }',
  ])
  assert.deepEqual(sent, ['{\n  issue(id: "issue1") {\n    title\n  }\n}'])
  assert.deepEqual(data, [
    {issue: {title: 'Ship the widget', shortTitle: 'Ship the widget'}},
    {issue: {shortTitle: 'Ship the widget'}},
  ])
})

test('returns each response key when inline fragments on one type merge', async () => {
  const {data} = await batchTrackerRequests([
    '{ issue(id: "issue1") { ... on Issue { title } ... on Issue { shortTitle: title } } }',
  ])
  assert.deepEqual(data, [{issue: {title: 'Ship the widget', shortTitle: 'Ship the widget'}}])
})

test('returns __typename when an aliased __typename follows it', async () => {
  const {data} = await batchTrackerRequests([
    '{ issue(id: "issue1") { __typename __isIntegration: __typename } }',
  ])
  assert.deepEqual(data, [
    {issue: {__typename: '_xTrackerIssue', __isIntegration: '_xTrackerIssue'}},
  ])
})

test('returns the subfields of a field selected again in a fragment', async () => {
  const {data} = await batchTrackerRequests([
    `{ issue(id: "issue1") { assignee { id } ...IssueAssignee } }
    fragment IssueAssignee on Issue { assignee { name } }`,
  ])
  assert.deepEqual(data, [{issue: {assignee: {id: 'user1', name: 'Ada'}}}])
})

test('returns the subfields of a field selected directly & in a fragment when another request shares its parent', async () => {
  const query = `{ issue(id: "issue1") { assignee { id } ...IssueAssignee } }
    fragment IssueAssignee on Issue { assignee { name } }`
  const assignee = {id: 'user1', name: 'Ada'}
  const titleFirst = await batchTrackerRequests(['{ issue(id: "issue1") { title } }', query])
  assert.deepEqual(titleFirst.data, [{issue: {title: 'Ship the widget'}}, {issue: {assignee}}])
  const assigneeFirst = await batchTrackerRequests([
    '{ issue(id: "issue1") { assignee { id } } }',
    query,
  ])
  assert.deepEqual(assigneeFirst.data, [{issue: {assignee: {id: 'user1'}}}, {issue: {assignee}}])
})

test('returns each key of a field that a fragment selects twice, for each request that spreads it', async () => {
  const query = `{ issue(id: "issue1") { ...IssueAssignees } }
    fragment IssueAssignees on Issue { a: assignee { id } b: assignee { name } }`
  const {data} = await batchTrackerRequests([query, query])
  const issue = {a: {id: 'user1'}, b: {name: 'Ada'}}
  assert.deepEqual(data, [{issue}, {issue}])
})

test("keeps a fragment's field apart from the field another request gives its response key", async () => {
  const {data} = await batchTrackerRequests([
    '{ issue(id: "issue1") { title: id } }',
    '{ issue(id: "issue1") { ... on Issue { title } } }',
    `{ issue(id: "issue1") { ...IssueTitle } }
    fragment IssueTitle on Issue { title }`,
  ])
  assert.deepEqual(data, [
    {issue: {title: 'issue1'}},
    {issue: {title: 'Ship the widget'}},
    {issue: {title: 'Ship the widget'}},
  ])
})

test('keeps the fields of fragments at the root apart, with the variables of each request', async () => {
  const query = `query ($id: ID!) { ...IssueById }
    fragment IssueById on Query { issue(id: $id) { title } }`
  const {data} = await batchTrackerRequests(
    [query, query, '{ issue(id: "issue1") { id } }'],
    [{id: 'issue1'}, {id: 'issue2'}],
  )
  assert.deepEqual(data, [
    {issue: {title: 'Ship the widget'}},
    {issue: {title: 'Fix the gadget'}},
    {issue: {id: 'issue1'}},
  ])
})

test('returns a list that has a null item', async () => {
  const {data} = await batchTrackerRequests(['{ issue(id: "issue1") { labels { name } } }'])
  assert.deepEqual(data, [{issue: {labels: [{name: 'bug'}, null]}}])
})
