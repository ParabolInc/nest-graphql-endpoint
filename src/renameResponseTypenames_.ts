import isObject from './isObject.ts'
import type {AliasMap, EndpointResponseData} from './types.ts'

const renameResponseTypenames = (
  response: EndpointResponseData,
  prefix: string,
  aliasMaps: AliasMap[],
) => {
  if (!response) return
  const prefixTypename = (name: string) => (name.startsWith(prefix) ? name : `${prefix}${name}`)
  // a list can hold nulls, and a fragment that doesn't apply leaves its fields out of the response
  const transformValue_ = (value: unknown, aliasMap: AliasMap) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        transformValue_(item, aliasMap)
      })
    } else if (isObject(value)) {
      transformObject_(value, aliasMap)
    }
  }
  const transformObject_ = (parent: Record<string, any>, aliasMap: AliasMap) => {
    Object.entries(aliasMap).forEach(([key, entries]) => {
      const val = parent[key]
      entries.forEach(({name, children}) => {
        if (name !== '__typename') {
          transformValue_(val, children)
        } else if (typeof val === 'string') {
          parent[key] = prefixTypename(val)
        }
      })
    })
  }
  aliasMaps.forEach((aliasMap) => {
    transformObject_(response, aliasMap)
  })
}

export default renameResponseTypenames
