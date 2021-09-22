import { GraphQLResolveInfo } from 'graphql';
import { NestGraphQLEndpointParams } from './types';
declare type NestParams = NestGraphQLEndpointParams<{
    accessToken: string;
    headers?: Record<string, string>;
}>;
declare type RequiredParams = Pick<NestParams, 'parentSchema' | 'parentType' | 'fieldName' | 'resolveEndpointContext'>;
declare type OptionalParams = Omit<Partial<NestParams>, keyof RequiredParams>;
declare type NestGitHubParams = RequiredParams & OptionalParams;
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
