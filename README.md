### Nest an external GraphQL Endpoint (Like GitHub's v4 API)

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
    // Not for production! See nestGitHubEndpoint for a production-ready example
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
})
```


### How it works

1. It extends your schema with a type that contains `{errors, query, mutation}`
2. Given a remote IDL, it prefixes the `__typename` so there are no conflicts with your own schema
3. It batches all requests by the `batchKey` so only 1 request is made per key. In the above example, this is the accessToken.
4. For each batched request, it removes the `__typename` prefix and merges the fragments, variableDefinitions, and variables.
5. In the event of a name conflict, it will alias fields before the request is fetched.
6. When the endpoint responds, it will de-alias the response, re-apply the `__typename` prefix, and filter the errors by path


### License

MIT
