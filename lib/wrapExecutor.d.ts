import { Executor } from "./types";
declare const wrapExecutor: <TContext>(executor: Executor<TContext>, prefix: string) => Executor<TContext>;
export default wrapExecutor;
