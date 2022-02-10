import {parse, print} from 'graphql'
import mergeGQLDocuments from '../src/mergeGQLDocuments'

const test1 = () => {
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
  const {document, aliasMaps} = mergeGQLDocuments(execParams)
  const docStr = print(document)
  console.log(docStr)
}

test1()
