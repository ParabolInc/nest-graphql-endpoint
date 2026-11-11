## Nest an external GraphQL Endpoint (Like GitHub's v4 API)

### How it works

https://www.parabol.co/blog/nest-github-api-in-graphql-schema

### Install

```sh
pnpm add nest-graphql-endpoint graphql
```

The package is ESM only and needs Node 22.18 or later, where CommonJS can `require()` it too.

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
import {nestGraphQLEndpoint, nestGraphQLEndpoints} from 'nest-graphql-endpoint'
import {print} from 'graphql'
import schemaIDL from './remoteSchemaIDL'

const github = nestGraphQLEndpoint({
  parentType: 'User',
  fieldName: 'github',
  resolveEndpointContext: (source) => ({accessToken: source.accessToken}),
  executor: (document, variables, context) => {
    // Example executor fn not for production! It needs a timeout, error handling, etc.
    return fetch('https://foo.co', {
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
      },
      body: JSON.stringify({query: print(document), variables}),
    })
  },
  prefix: '_extEndpoint',
  batchKey: 'accessToken',
  schemaIDL,
})

// nest as many endpoints as you like, all in one schema build
export default nestGraphQLEndpoints(schema, [github])
```

### Only build the nested types you use

A big endpoint like GitHub's has thousands of types, and building them takes most of a server's startup.
If you know the operations your app sends, e.g. persisted queries, build only what they use:

```ts
import {buildSchema, parse} from 'graphql'
import {getNestedUsage, nestGraphQLEndpoints} from 'nest-graphql-endpoint'

// at build time, against a schema printed with every nested type
const usage = getNestedUsage(
  buildSchema(fullSDL),
  persistedQueries.map((query) => parse(query)),
  ['_extEndpoint'],
)

// at runtime
const schema = nestGraphQLEndpoints(parentSchema, [github], {usage})
```

Every union member & interface implementation of a used type is kept, and each kept type has at least 1 field, so the schema is always valid.
Usage is keyed by the prefixed type name. Add the fields your own resolvers define on nested types to it, too.

An operation the usage didn't foresee, like an ad-hoc query, can use a schema with every nested type instead.
`findMissingNestedField` returns the first nested type or field the schema left out, so you can build that schema the first time you need it:

```ts
import {findMissingNestedField} from 'nest-graphql-endpoint'

if (findMissingNestedField(schema, document, [github])) {
  fullSchema ??= nestGraphQLEndpoints(parentSchema, [github])
  // execute the document against fullSchema
}
```

A field the endpoint doesn't have either isn't missing, and introspection (`__schema`, `__type`) is, since it describes the whole schema.

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
const github = nestGraphQLEndpoint({...})

const todoResolver = async (source, args, context, info) => {
  if (source.type === 'github') {
    const {nameWithOwner, issueNumber} = source
    const [repoOwner, repoName] = nameWithOwner.split('/')
    const query = `
          {
            repository(owner: "${repoOwner}", name: "${repoName}") {
              issue(number: ${issueNumber}) {
                ...info
              }
            }
          }`
    const {data, errors} = await github.request({
      query,
      endpointContext: {accessToken: '123'},
      // shares the batch with the rest of this execution
      batchRef: context,
      info,
    })
    return data
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

### Limitations

- FragmentDefinitions are assumed equal if they have matching names (Relay compiler guarantees this)

### Development

```sh
pnpm install
pnpm test       # node --test, running the TypeScript sources directly
pnpm check      # Biome
pnpm typecheck
pnpm build      # dist/, which `pnpm pack` & `pnpm publish` build for you
```

### License

MIT
