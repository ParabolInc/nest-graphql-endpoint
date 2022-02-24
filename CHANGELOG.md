# nest-graphql-endpoint

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
