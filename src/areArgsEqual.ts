import {ArgumentNode, Kind, print} from 'graphql'

const printArgs = (argArr: readonly ArgumentNode[]) => {
  return print({
    kind: Kind.FIELD,
    name: {
      kind: Kind.NAME,
      value: '',
    },
    arguments: argArr,
  })
}

const areArgsEqual = (
  aArgs: readonly ArgumentNode[] | null | undefined,
  bArgs: readonly ArgumentNode[] | null | undefined,
) => {
  if (aArgs && bArgs) {
    if (aArgs.length !== bArgs.length) return false
    // field args are already sorted
    return printArgs(aArgs) === printArgs(bArgs)
  }
  return aArgs === bArgs
}

export default areArgsEqual
