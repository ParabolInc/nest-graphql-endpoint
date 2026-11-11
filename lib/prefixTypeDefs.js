"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNestableDefinition = void 0;
const graphql_1 = require("graphql");
const unprefixedTypeNames = new Set(graphql_1.specifiedScalarTypes.map(({ name }) => name));
const specifiedDirectiveNames = new Set(graphql_1.specifiedDirectives.map(({ name }) => name));
const namedNodeKinds = new Set([
    graphql_1.Kind.NAMED_TYPE,
    graphql_1.Kind.SCALAR_TYPE_DEFINITION,
    graphql_1.Kind.OBJECT_TYPE_DEFINITION,
    graphql_1.Kind.INTERFACE_TYPE_DEFINITION,
    graphql_1.Kind.UNION_TYPE_DEFINITION,
    graphql_1.Kind.ENUM_TYPE_DEFINITION,
    graphql_1.Kind.INPUT_OBJECT_TYPE_DEFINITION,
    graphql_1.Kind.SCALAR_TYPE_EXTENSION,
    graphql_1.Kind.OBJECT_TYPE_EXTENSION,
    graphql_1.Kind.INTERFACE_TYPE_EXTENSION,
    graphql_1.Kind.UNION_TYPE_EXTENSION,
    graphql_1.Kind.ENUM_TYPE_EXTENSION,
    graphql_1.Kind.INPUT_OBJECT_TYPE_EXTENSION,
]);
// The endpoint's root types are not roots in the parent schema, and the parent's built-in directives win
const isNestableDefinition = (definition) => definition.kind !== graphql_1.Kind.SCHEMA_DEFINITION &&
    definition.kind !== graphql_1.Kind.SCHEMA_EXTENSION &&
    !(definition.kind === graphql_1.Kind.DIRECTIVE_DEFINITION &&
        specifiedDirectiveNames.has(definition.name.value));
exports.isNestableDefinition = isNestableDefinition;
// Renames every type except the built-in scalars, root types included, without building a schema to rename
const prefixTypeDefs = (document, prefix) => (0, graphql_1.visit)(document, {
    Name(node, _key, parent) {
        const parentNode = parent;
        if (!parentNode || !namedNodeKinds.has(parentNode.kind))
            return undefined;
        if (unprefixedTypeNames.has(node.value))
            return undefined;
        return { ...node, value: `${prefix}${node.value}` };
    },
});
exports.default = prefixTypeDefs;
//# sourceMappingURL=prefixTypeDefs.js.map