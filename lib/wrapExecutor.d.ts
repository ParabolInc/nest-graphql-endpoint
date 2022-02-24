import { Executor } from './types';
declare const wrapExecutor: <TContext>(executor: Executor<TContext>) => Executor<TContext>;
export default wrapExecutor;
