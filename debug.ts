// import {makeExecutableSchema} from '@graphql-tools/schema'
// import fs from 'fs'
// import {print} from 'graphql'
// import transformNestedSelection from './src/transformNestedSelection'
// import wrapper from './wrapper.json'
// import info from './info.json'

// const doStuff = async () => {
//   const prefix = ''
//   const schemaTxt = fs.readFileSync('./schema.graphql', 'utf8')
//   const schema = makeExecutableSchema({
//     typeDefs: schemaTxt,
//   })
//   info.schema = schema
//   info.returnType = schema.getType(info.returnType)
//   const {document} = transformNestedSelection(info, prefix, wrapper)
//   console.log(print(document))
// }

// doStuff()
