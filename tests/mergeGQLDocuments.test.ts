import assert from 'node:assert/strict'
import {test} from 'node:test'
import {parse, print} from 'graphql'
import dealiasResult from '../src/dealiasResult.ts'
import mergeGQLDocuments from '../src/mergeGQLDocuments.ts'

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
        ...PokerEstimateHeaderCardGitHub_issue
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
        ...PokerEstimateHeaderCardGitHub_issue
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
