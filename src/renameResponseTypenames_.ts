import {EndpointExecutionResult} from './types'

const renameResponseTypenames = (response: EndpointExecutionResult, prefix: string) => {
  const prefixTypename = (name: string) => `${prefix}${name}`
  const transformObject_ = (parent: Record<string, any>) => {
    Object.keys(parent).forEach((key) => {
      const val = parent[key]
      if (key === '__typename') {
        parent[key] = prefixTypename(val as string)
      } else if (Array.isArray(val)) {
        val.forEach((child) => {
          transformObject_(child)
        })
      } else if (typeof val === 'object' && val !== null) {
        transformObject_(val)
      }
    })
  }
  transformObject_(response)
}

export default renameResponseTypenames
