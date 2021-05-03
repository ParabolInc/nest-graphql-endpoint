import { NestGraphQLEndpointParams } from './types';
declare type NestGitHubParams = {
    prefix?: string;
} & Pick<NestGraphQLEndpointParams<{
    accessToken: string;
}>, 'parentSchema' | 'parentType' | 'fieldName' | 'resolveEndpointContext'>;
declare const nestGitHubEndpoint: (params: NestGitHubParams) => import("graphql").GraphQLSchema;
export default nestGitHubEndpoint;
