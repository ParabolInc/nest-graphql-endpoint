import { DefinitionNode, DocumentNode } from 'graphql';
import { AliasMap, Variables } from './types';
interface CachedExecParams {
    document: DocumentNode;
    variables: Variables;
}
declare const mergeGQLDocuments: (cachedExecParams: CachedExecParams[], isMutation?: boolean | undefined) => {
    document: {
        kind: "Document";
        definitions: DefinitionNode[];
    };
    variables: Variables;
    aliasMaps: AliasMap[];
};
export default mergeGQLDocuments;
