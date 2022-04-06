"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const getVarsAndDefMapper_ = (variableDefinitions, baseVariables, variables, aliasIdx) => {
    // adds new variables to baseVariables and returns the new names of the variables
    const varDefMapper = {};
    variableDefinitions.forEach((varDef) => {
        const { directives, variable } = varDef;
        const { name } = variable;
        const { value: varName } = name;
        const varValue = variables[varName];
        const hasDirectives = directives && directives.length > 0;
        const entryWithSameValue = hasDirectives
            ? undefined
            : Object.entries(baseVariables).find((entry) => entry[1] === varValue);
        if (entryWithSameValue) {
            // reuse a variable that has the same value
            varDefMapper[varName] = entryWithSameValue[0];
        }
        else {
            const doSuffix = hasDirectives || varName in baseVariables;
            const suffixedVarName = doSuffix ? `${varName}_${aliasIdx}` : varName;
            baseVariables[suffixedVarName] = varValue;
            varDefMapper[varName] = suffixedVarName;
        }
    });
    return varDefMapper;
};
const aliasDocVariables_ = (execParams, aliasIdx, baseVariables) => {
    // mutates the baseVariables
    const { document, variables } = execParams;
    const operationDef = document.definitions.find((def) => def.kind === 'OperationDefinition');
    const { variableDefinitions } = operationDef;
    const varDefMapper = getVarsAndDefMapper_(variableDefinitions, baseVariables, variables, aliasIdx);
    const nameSort = (a, b) => a.name.value < b.name.value ? -1 : 1;
    const falsyOrEmpty = (node) => !node || node.length === 0;
    return (0, graphql_1.visit)(document, {
        Field: (node) => {
            // sort directives & args for easy equality checks later
            if (falsyOrEmpty(node.arguments) && falsyOrEmpty(node.directives))
                return undefined;
            return {
                ...node,
                directives: node.directives ? node.directives.slice().sort(nameSort) : node.directives,
                arguments: node.arguments ? node.arguments.slice().sort(nameSort) : node.arguments,
            };
        },
        Variable: (node) => {
            const { name } = node;
            const value = varDefMapper[name.value];
            return {
                ...node,
                name: {
                    ...name,
                    value,
                },
            };
        },
        leave: {
            OperationDefinition: (node) => {
                const { variableDefinitions } = node;
                if (!variableDefinitions)
                    return undefined;
                const usedVariableDefNames = new Set();
                return {
                    ...node,
                    // if var1 and var2 both had the value of foo, change var2 references to var1 (in "Variable" visitor above)
                    // and remove duplicate var2 from the defs here
                    variableDefinitions: variableDefinitions.filter((varDef) => {
                        const { variable } = varDef;
                        const { name } = variable;
                        const { value: varName } = name;
                        if (usedVariableDefNames.has(varName))
                            return false;
                        usedVariableDefNames.add(varName);
                        return true;
                    }),
                };
            },
        },
    });
};
exports.default = aliasDocVariables_;
//# sourceMappingURL=aliasDocVariables_.js.map