import {DefinitionNode, DocumentNode} from 'graphql'
import {AliasMapper, Variables} from './types'
interface CachedExecParams {
  document: DocumentNode
  variables: Variables
}
declare const mergeGQLDocuments: (
  cachedExecParams: CachedExecParams[],
  isMutation?: boolean | undefined,
) =>
  | {
      aliasMaps: AliasMapper[]
      document: DocumentNode
      variables: Variables
    }
  | {
      document: {
        kind: 'Document'
        definitions: DefinitionNode[]
      }
      variables: {}
      aliasMaps: AliasMapper[]
    }
export default mergeGQLDocuments
