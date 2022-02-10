import {AliasMapper, EndpointResponseData} from './types'
declare const dealiasResult: (
  data: EndpointResponseData,
  aliasMap: AliasMapper,
) => EndpointResponseData
export default dealiasResult
