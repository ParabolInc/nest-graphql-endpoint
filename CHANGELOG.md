# nest-graphql-endpoint

## 1.0.0

### BREAKING

- `nestGraphQLEndpoint` no longer takes a `parentSchema` or returns a schema. It returns an endpoint, and `nestGraphQLEndpoints(parentSchema, endpoints, options)` builds one schema with all of them
- `githubRequest` is now each endpoint's `request({query, endpointContext, info, variables, batchRef})`
- Removed `nestGitHubEndpoint` and the `@octokit/graphql-schema` & `@graphql-tools/wrap` dependencies
- ESM only, for Node 22.18 or later, where CommonJS can still `require()` it. Built files moved from `lib/` to `dist/`, and only the package root is exported, so import from `nest-graphql-endpoint`

### Added

- `usage` option: build only the nested types & fields that your operations use
- `getNestedUsage` finds that usage in a set of documents
- `findMissingNestedField` finds what a pruned schema left out of a document, e.g. to run it on a schema with every nested type
- `mergeNestedUsage`
- `assumeValidSDL` & `updateResolversInPlace` options, passed to `makeExecutableSchema`
- `nestGraphQLEndpoint` is a named export, too

### Changed

- An endpoint builds its own schema the first time a request needs it, instead of at startup. `getEndpointSchema()` returns it
- Depends on `@graphql-tools/schema` 10 or 11 and `@graphql-tools/utils` 12 or 13, and no longer on `typescript` or `tslib`
- Built with TypeScript 7. The repo uses pnpm, Biome and `node:test`, and no longer commits build output
- Every merge to `main` publishes a new version to npm, with provenance

## 0.8.3

- Fix: don't infer operation type from parent query in
  `transformNestedSelection`, instead use explicit `isMutation` flag

## 0.8.2

- Fix applied when calling mutations with optional vars

## 0.8.0

- Bump deps
- Drop support for GraphQL v15 (uncompatible vistor)

## 0.7.1

### Removed

- Removed node-fetch

## 0.7.0

### BREAKING

- Drop support for Node below v16

## 0.6.2

### Fixed

- Schema introspection, do not override private type resolvers

## 0.6.1

Changed

- Reverted node-fetch back to v2

## 0.6.0

### Changed

- Bump all packages

### Added

- Check aliased value from source

## 0.5.1

### Fixed

- pruneExtended after wrapper gets merged into place

## 0.5.0

### Added

- Automatically remove fields that don't belong in the endpoint

## 0.4.4

## Fixed

- Disallow double prefixing on rehydration

## 0.4.3

## Fixed

- Check duplicates by name value

## 0.4.2

## Fixed

- client-aliased \_\_typename field re-prefixing
- remove duplicate variable definitions for shared variables
- Support directives on variable definitions

## 0.4.1

### Fixed

- unsuffixed naming collisio

## 0.4.0

### Fixed

- Variable merging bug

### Added

- Deeply nested merging (polynomial improvement in request cost)

## 0.3.3

### Fixed

- Remove fragment spreads for pruned fragment definitions

## 0.3.2

### Fixed

- varDef duplication finder

## 0.3.1

### Fixed

- Downgrade node-fetch. Why would they force ESM? >:0

## 0.3.0

### Changed

- `endpointTimeout` is now passed to the executor
- `nestGitHubEndpoint` accepts all the params as `nestGraphQLEndpoint`

## 0.2.2

### Fixed

- Prune field nodes, not user-defined wrapper

## 0.2.1

### Fixed

- Improved error filtering

## 0.2.0

### Added

- Support for wrapped return types
- Support for wrapper vars
- Support for wrapper fragments
- githubRequest is a generic for better var params and data output

## 0.1.0

### Added

- field resolver functionality
- githubRequest on nestGitHubEndpoint

## 0.0.2

### Fixed

- Un-prefixing bug

## 0.0.1

### Added

- Initial commit
