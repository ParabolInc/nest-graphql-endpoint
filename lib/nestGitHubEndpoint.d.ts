import { GraphQLResolveInfo } from 'graphql';
import { NestGraphQLEndpointParams } from './types';
type NestParams = NestGraphQLEndpointParams<{
    accessToken: string;
    headers?: Record<string, string>;
}>;
type RequiredParams = Pick<NestParams, 'parentSchema' | 'parentType' | 'fieldName' | 'resolveEndpointContext'>;
type OptionalParams = Omit<Partial<NestParams>, keyof RequiredParams>;
type NestGitHubParams = RequiredParams & OptionalParams;
interface Input<TVars> {
    query: string;
    endpointContext: Record<string, any>;
    info: GraphQLResolveInfo;
    variables?: TVars;
    batchRef?: Record<any, any>;
}
declare const nestGitHubEndpoint: (params: NestGitHubParams) => {
    schema: import("graphql").GraphQLSchema;
    githubRequest: <TData = any, TVars = any>(input: Input<TVars>) => Promise<{
        data: TData;
        errors: import("./types").BaseGraphQLError[] | null | undefined;
    }>;
};
export default nestGitHubEndpoint;
