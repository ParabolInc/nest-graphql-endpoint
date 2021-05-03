import { GraphQLResolveInfo } from 'graphql';
import { Variables } from './types';
declare const transformNestedSelection: (info: GraphQLResolveInfo, prefix: string) => {
    document: any;
    variables: Variables;
};
export default transformNestedSelection;
