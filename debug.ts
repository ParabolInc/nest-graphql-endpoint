// SETUP
// 1. run the problematic query or mutation & do a fs.writeFileSync on the info object from the resolver
// 2. Paste info.json into the root dir here
// 3. Paste schema.graphql into the root dir here
// 4. run the code!


// import { makeExecutableSchema } from '@graphql-tools/schema'
// import fs from 'fs'
// import { parse, print } from 'graphql'
// // import wrapper from './wrapper.json'
// import info from './info.json'
// import transformNestedSelection from './src/transformNestedSelection'


// const doStuff = async () => {
//   const prefix = '_xGitHub'
//   const schemaTxt = fs.readFileSync('./schema.graphql', 'utf8')
//   const schema = makeExecutableSchema({
//     typeDefs: schemaTxt,
//   })
//   info.schema = schema
//   info.returnType = schema.getType(info.returnType)
//   const repoOwner = 'parabolinc'
//   const repoName = 'testrepo'
//   const issueNumber = '200'
//   const wrapperStr = `
//                 {
//                   repository(owner: "${repoOwner}", name: "${repoName}") {
//                     issue(number: ${issueNumber}) {
//                       ...info
//                     }
//                   }
//                 }`
//   const wrapper = parse(wrapperStr)
//   const {document} = transformNestedSelection(info, prefix, wrapper)
//   console.log(print(document))
// }

// doStuff()
