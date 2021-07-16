import { DocumentNode, GraphQLResolveInfo } from 'graphql';
declare const pruneLocalTypes: (doc: DocumentNode, prefix: string, info: GraphQLResolveInfo) => DocumentNode;
export default pruneLocalTypes;
