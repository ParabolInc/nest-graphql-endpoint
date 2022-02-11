import { AliasMap } from './types';
declare const dealiasResult: (data: Record<string, any> | null, aliasMap: AliasMap) => Record<string, any> | null;
export default dealiasResult;
