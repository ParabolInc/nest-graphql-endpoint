import { GraphQLResolveInfo } from 'graphql';
import { NestGraphQLEndpointParams } from './types';
declare type NestGitHubParams = {
    prefix?: string;
} & Pick<NestGraphQLEndpointParams<{
    accessToken: string;
}>, 'parentSchema' | 'parentType' | 'fieldName' | 'resolveEndpointContext'>;
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
