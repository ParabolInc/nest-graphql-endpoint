import renameResponseTypenames_ from './renameResponseTypenames_'
import {Executor} from './types'

const wrapExecutor = <TContext>(
  executor: Executor<TContext>,
  prefix: string,
): Executor<TContext> => async (document, variables, context) => {
  try {
    const response = await executor(document, variables, context)
    renameResponseTypenames_(response, prefix)
    return response
  } catch (e) {
    return {
      data: null,
      errors: [
        {
          message: e?.message ?? `${prefix}: Executor failed`,
        },
      ],
    }
  }
}

export default wrapExecutor
