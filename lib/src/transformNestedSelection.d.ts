import { DocumentNode, GraphQLResolveInfo } from 'graphql';
import { Variables } from './types';
declare const transformNestedSelection: (info: GraphQLResolveInfo, prefix: string, wrapper?: DocumentNode | undefined) => {
    document: DocumentNode;
    variables: Variables;
    wrappedPath?: undefined;
} | {
    document: DocumentNode;
    variables: Variables;
    wrappedPath: string[] | undefined;
};
export default transformNestedSelection;
