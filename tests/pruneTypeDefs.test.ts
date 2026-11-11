import assert from 'node:assert/strict'
import {test} from 'node:test'
import {
  buildASTSchema,
  buildSchema,
  concatAST,
  type DocumentNode,
  isObjectType,
  parse,
  validateSchema,
} from 'graphql'
import getNestedUsage, {findMissingNestedField} from '../src/getNestedUsage.ts'
import prefixTypeDefs from '../src/prefixTypeDefs.ts'
import pruneTypeDefs from '../src/pruneTypeDefs.ts'

const sdl = `
  interface Node { id: ID! }
  interface Labelable { labels(first: Int!): [Label!]! }
  type Query {
    viewer: User!
    node(id: ID!): Node
    search(query: String!, filter: SearchFilter): [SearchResult!]!
    unused: Unused
  }
  type Mutation { createIssue(input: CreateIssueInput!): Issue }
  type User implements Node { id: ID! login: String! repos: [Repo!]! }
  type Repo implements Node { id: ID! name: String! }
  type Issue implements Node & Labelable { id: ID! title: String! labels(first: Int!): [Label!]! author: User! }
  type PullRequest implements Node & Labelable { id: ID! labels(first: Int!): [Label!]! merged: Boolean! }
  type Label { name: String! color: String! }
  type Unused { field: String }
  union SearchResult = Issue | PullRequest
  input SearchFilter { state: IssueState nested: NestedFilter }
  input NestedFilter { since: String }
  input CreateIssueInput { title: String! }
  enum IssueState { OPEN CLOSED }
`

// nested types sit under a parent's root, like the Api type does
const buildNested = (document: DocumentNode) =>
  buildASTSchema(
    concatAST([
      prefixTypeDefs(document, '_x'),
      parse('type Query { query: _xQuery mutation: _xMutation }'),
    ]),
  )

const fieldsOf = (schema: ReturnType<typeof buildNested>, typeName: string) => {
  const type = schema.getType(typeName)
  assert(isObjectType(type), `${typeName} should be an object type`)
  return Object.keys(type.getFields()).sort()
}

test('keeps the used fields and what a valid schema needs around them', () => {
  const pruned = pruneTypeDefs(parse(sdl), {
    Query: ['search', 'viewer'],
    Mutation: [],
    Issue: ['title'],
    User: ['login'],
  })
  const schema = buildNested(pruned)
  assert.deepEqual(validateSchema(schema), [], 'the pruned schema is valid')

  // the selected fields, plus what a valid schema needs around them
  assert.deepEqual(fieldsOf(schema, '_xQuery'), ['search', 'viewer'])
  assert.deepEqual(fieldsOf(schema, '_xIssue'), ['title'])
  assert.deepEqual(fieldsOf(schema, '_xUser'), ['login'])
  // every union member stays, because the endpoint can return any of them, with its cheapest field
  assert.deepEqual(fieldsOf(schema, '_xPullRequest'), ['id'])
  // inputs stay whole, with the types of their fields
  assert(
    schema.getType('_xSearchFilter') &&
      schema.getType('_xNestedFilter') &&
      schema.getType('_xIssueState'),
  )
  // a mutation root with no selected fields still gets one, since the Api type returns it
  assert.deepEqual(fieldsOf(schema, '_xMutation'), ['createIssue'])
  assert(schema.getType('_xCreateIssueInput'))
  // nothing else
  assert(!schema.getType('_xUnused'), 'unused types are dropped')
  assert(!schema.getType('_xRepo') && !schema.getType('_xLabel') && !schema.getType('_xNode'))
  assert(!schema.getType('_xLabelable'), 'an unused interface is dropped along with its implements')
})

test('an interface that is used keeps every implementation, each with its fields', () => {
  const withInterface = buildNested(
    pruneTypeDefs(parse(sdl), {Query: ['node'], Mutation: [], Node: ['id'], Labelable: ['labels']}),
  )
  assert.deepEqual(validateSchema(withInterface), [])
  assert.deepEqual(fieldsOf(withInterface, '_xRepo'), ['id'])
  assert.deepEqual(fieldsOf(withInterface, '_xIssue'), ['id', 'labels'])
  assert.deepEqual(fieldsOf(withInterface, '_xPullRequest'), ['id', 'labels'])
  assert.deepEqual(
    fieldsOf(withInterface, '_xLabel'),
    ['name'],
    'a returned type gets its cheapest field',
  )
  assert.deepEqual(fieldsOf(withInterface, '_xUser'), ['id'])
})

const fullSchema = buildNested(parse(sdl))
const documents = [
  parse(`{ query { viewer { login } search(query: "x") { ... on _xIssue { title } } } }`),
  parse(`fragment Repo on _xRepo { name }`),
]

test('usage is what the documents select, and only fields the schema has', () => {
  assert.deepEqual(
    getNestedUsage(
      fullSchema,
      [...documents, parse('{ query { viewer { clientOnly } } }')],
      ['_x'],
    ),
    {
      _xIssue: ['title'],
      _xQuery: ['search', 'viewer'],
      _xRepo: ['name'],
      _xUser: ['login'],
    },
    'a field the schema does not have is not usage',
  )
})

const usage = getNestedUsage(fullSchema, documents, ['_x'])
const unprefixedUsage = Object.fromEntries(
  Object.entries(usage).map(([typeName, fieldNames]) => [typeName.slice(2), fieldNames]),
)
const usageSchema = buildNested(pruneTypeDefs(parse(sdl), {...unprefixedUsage, Mutation: []}))
const endpoints = [{prefix: '_x', getEndpointSchema: () => buildSchema(sdl)}]
const findMissing = (query: string) => findMissingNestedField(usageSchema, parse(query), endpoints)

test('a schema built from usage serves the documents it came from', () => {
  assert.deepEqual(validateSchema(usageSchema), [])
  documents.forEach((document) => {
    assert.equal(findMissingNestedField(usageSchema, document, endpoints), undefined)
  })
})

test('findMissingNestedField finds what the pruned schema left out', () => {
  assert.equal(findMissing('{ query { viewer { repos { id } } } }'), '_xUser.repos')
  assert.equal(findMissing('{ query { node(id: "1") { id } } }'), '_xQuery.node')
  assert.equal(
    findMissing('{ query { node(id: "1") { ... on _xPullRequest { id } } } }'),
    '_xQuery.node',
  )
  assert.equal(findMissing('fragment L on _xLabel { name }'), '_xLabel')
  assert.equal(findMissing('{ __schema { types { name } } }'), '__schema')
  assert.equal(findMissing('{ query { viewer { __typename login } } }'), undefined)
  assert.equal(
    findMissing('{ query { viewer { clientOnly login } } }'),
    undefined,
    'a field the endpoint does not have either is not missing',
  )
  assert.equal(
    findMissing('{ query { viewer { clientOnly { x } repos { id } } } }'),
    '_xUser.repos',
    'the search goes on past a field the endpoint does not have',
  )
  assert.equal(findMissing('fragment F on _xNotAType { id }'), undefined)
})
