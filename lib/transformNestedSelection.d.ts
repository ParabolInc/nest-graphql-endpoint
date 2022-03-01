import { DocumentNode, FragmentDefinitionNode, GraphQLResolveInfo, GraphQLSchema } from 'graphql';
import { Variables } from './types';
declare const transformNestedSelection: (schema: GraphQLSchema, info: GraphQLResolveInfo, prefix: string, wrapper?: DocumentNode | undefined) => {
    document: DocumentNode;
    variables: Variables;
    wrappedPath: undefined;
} | {
    document: {
        definitions: (FragmentDefinitionNode | {
            selectionSet: any;
            variableDefinitions: import("graphql").VariableDefinitionNode[];
            kind: "OperationDefinition";
            loc?: import("graphql").Location | undefined;
            operation: import("graphql").OperationTypeNode;
            name?: import("graphql").NameNode | undefined;
            directives?: readonly import("graphql").DirectiveNode[] | undefined;
        })[];
        kind: "Document";
        loc?: import("graphql").Location | undefined;
    };
    variables: Variables;
    wrappedPath: string[] | undefined;
};
export default transformNestedSelection;
