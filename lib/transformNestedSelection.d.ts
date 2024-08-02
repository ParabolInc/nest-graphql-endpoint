import { DocumentNode, FragmentDefinitionNode, GraphQLResolveInfo, GraphQLSchema, Kind } from 'graphql';
import { Variables } from './types';
declare const transformNestedSelection: (schema: GraphQLSchema, info: GraphQLResolveInfo, prefix: string, wrapper?: DocumentNode) => {
    document: DocumentNode;
    variables: Variables;
    wrappedPath: undefined;
} | {
    document: {
        definitions: (FragmentDefinitionNode | {
            selectionSet: import("graphql").SelectionSetNode;
            variableDefinitions: import("graphql").VariableDefinitionNode[];
            kind: Kind.OPERATION_DEFINITION;
            loc?: import("graphql").Location;
            operation: import("graphql").OperationTypeNode;
            name?: import("graphql").NameNode;
            directives?: ReadonlyArray<import("graphql").DirectiveNode>;
        })[];
        kind: Kind.DOCUMENT;
        loc?: import("graphql").Location;
    };
    variables: Variables;
    wrappedPath: string[] | undefined;
};
export default transformNestedSelection;
