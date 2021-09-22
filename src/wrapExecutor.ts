import renameResponseTypenames_ from './renameResponseTypenames_'
import {Executor} from './types'

const wrapExecutor = <TContext>(
  executor: Executor<TContext>,
  prefix: string,
): Executor<TContext> => async (document, variables, endpointTimeout, context) => {
  try {
    const response = await executor(document, variables, endpointTimeout, context)
    renameResponseTypenames_(response, prefix)
    return response
  } catch (e) {
    return {
      data: null,
      errors: [
        {
          message: (e as any)?.message ?? `${prefix}: Executor failed`,
        },
      ],
    }
  }
}

export default wrapExecutor
