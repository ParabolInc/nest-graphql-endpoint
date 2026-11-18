import isObject from './isObject.ts'
import type {AliasMap} from './types.ts'

// Several fields of the merged document can answer one response key of the request,
// e.g. one it selects directly & again in a fragment, so their values are combined
const mergeValues = (existing: unknown, value: unknown): unknown => {
  if (Array.isArray(existing) && Array.isArray(value)) {
    return existing.map((item, idx) => mergeValues(item, value[idx]))
  }
  if (isObject(existing) && isObject(value)) {
    const merged = {...existing}
    Object.entries(value).forEach(([key, val]) => {
      merged[key] = Object.hasOwn(merged, key) ? mergeValues(merged[key], val) : val
    })
    return merged
  }
  return value === undefined ? existing : value
}

const dealiasValue = (value: unknown, aliasMap: AliasMap): unknown => {
  if (Array.isArray(value)) return value.map((item) => dealiasValue(item, aliasMap))
  if (isObject(value)) return dealiasResult(value, aliasMap)
  return value
}

const dealiasResult = (data: Record<string, any> | null, aliasMap: AliasMap) => {
  if (!data || Object.keys(aliasMap).length === 0) return data
  const returnData = {} as Record<string, any>
  Object.entries(aliasMap).forEach(([alias, entries]) => {
    const rawValue = data[alias]
    entries.forEach(({name, children}) => {
      const value = dealiasValue(rawValue, children)
      returnData[name] = Object.hasOwn(returnData, name)
        ? mergeValues(returnData[name], value)
        : value
    })
  })
  return returnData
}
export default dealiasResult
