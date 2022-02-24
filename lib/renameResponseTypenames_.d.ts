import { AliasMap, EndpointResponseData } from './types';
declare const renameResponseTypenames: (response: EndpointResponseData, prefix: string, aliasMaps: AliasMap[]) => void;
export default renameResponseTypenames;
