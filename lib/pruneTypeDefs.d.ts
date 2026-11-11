import { DocumentNode } from 'graphql';
declare const pruneTypeDefs: (document: DocumentNode, usage: Record<string, readonly string[]>) => DocumentNode;
export default pruneTypeDefs;
