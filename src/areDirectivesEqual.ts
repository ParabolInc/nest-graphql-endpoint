import {DirectiveNode} from 'graphql'
import areArgsEqual from './areArgsEqual'

const areDirectivesEqual = (
  aDirectives: readonly DirectiveNode[] | null | undefined,
  bDirectives: readonly DirectiveNode[] | null | undefined,
) => {
  if (aDirectives && bDirectives) {
    if (aDirectives.length !== bDirectives.length) return false
    for (let i = 0; i < bDirectives.length; i++) {
      const aDir = aDirectives[i]
      const bDir = bDirectives[i]
      // make sure directives have same name
      if (aDir.name.value !== bDir.name.value) return false
      const areEqual = areArgsEqual(aDir.arguments, bDir.arguments)
      if (!areEqual) return false
    }
    return true
  }
  return aDirectives === bDirectives
}

export default areDirectivesEqual
