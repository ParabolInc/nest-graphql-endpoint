import { DefinitionNode, DocumentNode } from 'graphql';
export declare const isNestableDefinition: (definition: DefinitionNode) => boolean;
declare const prefixTypeDefs: (document: DocumentNode, prefix: string) => DocumentNode;
export default prefixTypeDefs;
