import {Executor} from './types'

const wrapExecutor =
  <TContext>(executor: Executor<TContext>): Executor<TContext> =>
  async (document, variables, endpointTimeout, context) => {
    try {
      const response = await executor(document, variables, endpointTimeout, context)
      return response
    } catch (e) {
      return {
        data: null,
        errors: [
          {
            message: (e as any)?.message ?? `nesting executor failed`,
          },
        ],
      }
    }
  }

export default wrapExecutor
