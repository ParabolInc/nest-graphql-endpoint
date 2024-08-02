import { DefinitionNode, DocumentNode, Kind } from 'graphql';
import { AliasMap, Variables } from './types';
interface CachedExecParams {
    document: DocumentNode;
    variables: Variables;
}
declare const mergeGQLDocuments: (cachedExecParams: CachedExecParams[], isMutation?: boolean) => {
    document: {
        kind: Kind.DOCUMENT;
        definitions: DefinitionNode[];
    };
    variables: Variables;
    aliasMaps: AliasMap[];
};
export default mergeGQLDocuments;
