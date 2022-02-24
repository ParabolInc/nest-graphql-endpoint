import { DocumentNode } from 'graphql';
import { Variables } from './types';
interface CachedExecParams {
    document: DocumentNode;
    variables: Variables;
}
declare const aliasDocVariables_: (execParams: CachedExecParams, aliasIdx: number, baseVariables: Variables) => DocumentNode;
export default aliasDocVariables_;
