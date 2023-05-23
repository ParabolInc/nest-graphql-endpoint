import { DocumentNode } from 'graphql';
import { GraphQLEndpointError } from './types';
declare const filterErrorsForDocument: (document: DocumentNode, errors?: GraphQLEndpointError[] | null) => GraphQLEndpointError[] | null | undefined;
export default filterErrorsForDocument;
