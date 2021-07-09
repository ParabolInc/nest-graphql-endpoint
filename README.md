## Nest an external GraphQL Endpoint (Like GitHub's v4 API)

### How it works

https://www.parabol.co/blog/nest-github-api-in-graphql-schema

### What's it do?

Merges a remote graphql endpoint into your schema.
For example, let's say your app has a GitHub integration.
Each user has used OAuth2 to allow your app to access GitHub on their behalf.
You have stored that token on the User object in your database.
Now, you want to get their name from your app & their bio from GitHub.
You also want the bio of all their friends, too.
This package will let you write the following query:


```gql
query {
  user(id: 'abc') {
    name
    github {
      errors {
        message
      }
      query {
        # These values come from GitHub
        viewer {
          bio
        }
      }
    }
    friends {
      github {
        errors {
          message
        }
        query {
          viewer {
            bio
          }
        }
      }
    }
    todos {
      ... on _extGitHubIssue {
        # These values come from GitHub, too
        number
        repository {
          nameWithOwner
        }
      }
    }
  }
}
```

### Example with your own endpoint

```ts
import {schema} from './mySchema'
import nestGraphQLEndpoint from 'nest-graphql-endpoint'
import {print} from 'graphql'
import schemaIDL from './remoteSchemaIDL'

return nestGraphQLEndpoint({
  parentSchema: schema,
  parentType: 'User',
  fieldName: 'github',
  resolveEndpointContext: (source) => ({accessToken: source.accessToken}),
  executor: (document, variables, context) => {
    // Executor fn not for production! See nestGitHubEndpoint for a production-ready executor
    return fetch('https://foo.co', {
      headers: {
        Authorization: `Bearer ${context.accessToken}`
      },
      body: JSON.stringify({query: print(document), variables })
    })
  },
  prefix: '_extEndpoint',
  batchKey: 'accessToken',
  schemaIDL
})
```

As a convenience, this package includes a helper for GitHub's API. If you'd like to add other endpoints, please make a PR.

### Example using GitHub's API

```ts
import {schema} from './mySchema'
import nestGitHubEndpoint from 'nest-graphql-endpoint/lib/nestGitHubEndpoint'

return nestGitHubEndpoint({
  parentSchema: schema,
  parentType: 'User',
  fieldName: 'github',
  // Assumes a `githubToken` is on the User object
  resolveEndpointContext: (source) => ({accessToken: source.githubToken})
}).schema
```

### Example field resolution

Say each `User` has a list of `todos` and some of those come from Jira & others come from GitHub.
```gql
type User {
  id: ID!
  todos: [Todo]
}
interface Todo {
  id: ID!
}
type _extGitHubIssue implements Todo
type JiraIssue implements Todo
```

```ts
// Front-end
const UserQuery = graphql`
  query UserQuery($userId: ID!) {
    user(id: $userId) {
      todos {
        __typename
        ... on JiraIssue {
          descriptionHTML
        }
      ... on  _extGitHubIssue {
        bodyHTML
        number
        respository {
          nameWithOwner
        }
      }
    }
  }
`;
const ShowTodo = (props) => {
  const data = useQuery(UserQuery)
  if (!data) return null
  return data.todos.map((todo) => {
    if todo.__typename === 'JiraIssue') {
      return <JiraTodo todo={todo}/>
    }
    return <GitHubTodo todo={todo}/>
  })
}
```

```ts
// Backend
const {schema, githubRequest} = nestGitHubEndpoint({...})

const todoResolver = (source, args, context, info) => {
  if (source.type === 'github') {
    const ghContext = {accessToken: '123'}
    const {nameWithOwner, issueNumber} = source
    const [repoOwner, repoName] = nameWithOwner.split('/')
    const wrapper = `
          {
            repository(owner: "${repoOwner}", name: "${repoName}") {
              issue(number: ${issueNumber}) {
                ...info
              }
            }
          }`
    const {data, errors} = await githubRequest(wrapper, ghContext, context, info)
    return data // returns
  }
}
```
### How it works

1. It extends your schema with a type that contains `{errors, query, mutation}`
2. Given a remote IDL, it prefixes the `__typename` so there are no conflicts with your own schema
3. It batches all requests by the `batchKey` so only 1 request is made per key. In the above example, this is the accessToken.
4. For each batched request, it removes the `__typename` prefix and merges the fragments, variableDefinitions, and variables.
5. In the event of a name conflict, it will alias fields before the request is fetched.
6. When the endpoint responds, it will de-alias the response, re-apply the `__typename` prefix, and filter the errors by path
7. For field resolvers, it removes any types that don't exist on the endpoint & then sends the request.

### License

MIT
