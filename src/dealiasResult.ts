import {AliasMap} from './types'

const dealiasResult = (data: Record<string, any> | null, aliasMap: AliasMap) => {
  if (!data || Object.keys(aliasMap).length === 0) return data
  const returnData = {} as Record<string, any>
  Object.entries(aliasMap).forEach(([alias, {name, children}]) => {
    const rawValue = data[alias]
    if (Array.isArray(rawValue)) {
      returnData[name] = rawValue.map((obj) => dealiasResult(obj, children))
    } else if (rawValue && typeof rawValue === 'object') {
      returnData[name] = dealiasResult(rawValue, children)
    } else {
      returnData[name] = rawValue
    }
  })
  return returnData
}
export default dealiasResult
