import { GraphQLResolveInfo } from 'graphql';
import { NestGraphQLEndpointParams } from './types';
declare type NestGitHubParams = {
    prefix?: string;
} & Pick<NestGraphQLEndpointParams<{
    accessToken: string;
}>, 'parentSchema' | 'parentType' | 'fieldName' | 'resolveEndpointContext'>;
declare const nestGitHubEndpoint: (params: NestGitHubParams) => {
    schema: import("graphql").GraphQLSchema;
    githubRequest: <T>(wrapper: string, endpointContext: T, context: any, info: GraphQLResolveInfo) => Promise<{
        data: any;
        errors: import("./types").BaseGraphQLError[] | null | undefined;
    }>;
};
export default nestGitHubEndpoint;
