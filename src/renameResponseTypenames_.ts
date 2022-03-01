import {AliasMap, EndpointResponseData} from './types'

const renameResponseTypenames = (
  response: EndpointResponseData,
  prefix: string,
  aliasMaps: AliasMap[],
) => {
  if (!response) return
  const prefixTypename = (name: string) => (name.startsWith(prefix) ? name : `${prefix}${name}`)
  const transformObject_ = (parent: Record<string, any>, aliasMap: AliasMap) => {
    Object.keys(aliasMap).forEach((key) => {
      const val = parent[key]
      const entry = aliasMap[key]
      const {name, children} = entry
      if (name === '__typename') {
        parent[key] = prefixTypename(val as string)
      } else if (Array.isArray(val)) {
        val.forEach((child) => {
          transformObject_(child, children)
        })
      } else if (typeof val === 'object' && val !== null) {
        transformObject_(val, children)
      }
    })
  }
  aliasMaps.forEach((aliasMap) => {
    transformObject_(response, aliasMap)
  })
}

export default renameResponseTypenames
