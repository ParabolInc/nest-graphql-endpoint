import {
  type ASTNode,
  type DefinitionNode,
  type DocumentNode,
  Kind,
  type NameNode,
  specifiedDirectives,
  specifiedScalarTypes,
  visit,
} from 'graphql'

const unprefixedTypeNames = new Set(specifiedScalarTypes.map(({name}) => name))
const specifiedDirectiveNames = new Set(specifiedDirectives.map(({name}) => name))
const namedNodeKinds = new Set<string>([
  Kind.NAMED_TYPE,
  Kind.SCALAR_TYPE_DEFINITION,
  Kind.OBJECT_TYPE_DEFINITION,
  Kind.INTERFACE_TYPE_DEFINITION,
  Kind.UNION_TYPE_DEFINITION,
  Kind.ENUM_TYPE_DEFINITION,
  Kind.INPUT_OBJECT_TYPE_DEFINITION,
  Kind.SCALAR_TYPE_EXTENSION,
  Kind.OBJECT_TYPE_EXTENSION,
  Kind.INTERFACE_TYPE_EXTENSION,
  Kind.UNION_TYPE_EXTENSION,
  Kind.ENUM_TYPE_EXTENSION,
  Kind.INPUT_OBJECT_TYPE_EXTENSION,
])

// The endpoint's root types are not roots in the parent schema, and the parent's built-in directives win
export const isNestableDefinition = (definition: DefinitionNode) =>
  definition.kind !== Kind.SCHEMA_DEFINITION &&
  definition.kind !== Kind.SCHEMA_EXTENSION &&
  !(
    definition.kind === Kind.DIRECTIVE_DEFINITION &&
    specifiedDirectiveNames.has(definition.name.value)
  )

// Renames every type except the built-in scalars, root types included, without building a schema to rename
const prefixTypeDefs = (document: DocumentNode, prefix: string): DocumentNode =>
  visit(document, {
    Name(node: NameNode, _key, parent) {
      const parentNode = parent as ASTNode | undefined
      if (!parentNode || !namedNodeKinds.has(parentNode.kind)) return undefined
      if (unprefixedTypeNames.has(node.value)) return undefined
      return {...node, value: `${prefix}${node.value}`}
    },
  })

export default prefixTypeDefs
