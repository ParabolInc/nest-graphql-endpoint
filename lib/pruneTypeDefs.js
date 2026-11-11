"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const getNamedTypeName = (type) => type.kind === graphql_1.Kind.NAMED_TYPE ? type.name.value : getNamedTypeName(type.type);
const indexTypes = (document) => {
    const types = new Map();
    const getEntry = (name, kind, isInterface = false) => {
        const entry = types.get(name) ?? {
            kind,
            isInterface,
            fields: new Map(),
            inputFields: [],
            interfaces: [],
            members: [],
        };
        types.set(name, entry);
        return entry;
    };
    document.definitions.forEach((definition) => {
        switch (definition.kind) {
            case graphql_1.Kind.OBJECT_TYPE_DEFINITION:
            case graphql_1.Kind.OBJECT_TYPE_EXTENSION:
            case graphql_1.Kind.INTERFACE_TYPE_DEFINITION:
            case graphql_1.Kind.INTERFACE_TYPE_EXTENSION: {
                const isInterface = definition.kind === graphql_1.Kind.INTERFACE_TYPE_DEFINITION ||
                    definition.kind === graphql_1.Kind.INTERFACE_TYPE_EXTENSION;
                const entry = getEntry(definition.name.value, 'fielded', isInterface);
                definition.fields?.forEach((field) => entry.fields.set(field.name.value, field));
                definition.interfaces?.forEach((iface) => entry.interfaces.push(iface.name.value));
                break;
            }
            case graphql_1.Kind.UNION_TYPE_DEFINITION:
            case graphql_1.Kind.UNION_TYPE_EXTENSION:
                getEntry(definition.name.value, 'union').members.push(...(definition.types ?? []).map((member) => member.name.value));
                break;
            case graphql_1.Kind.INPUT_OBJECT_TYPE_DEFINITION:
            case graphql_1.Kind.INPUT_OBJECT_TYPE_EXTENSION:
                getEntry(definition.name.value, 'input').inputFields.push(...(definition.fields ?? []));
                break;
            case graphql_1.Kind.ENUM_TYPE_DEFINITION:
            case graphql_1.Kind.ENUM_TYPE_EXTENSION:
            case graphql_1.Kind.SCALAR_TYPE_DEFINITION:
            case graphql_1.Kind.SCALAR_TYPE_EXTENSION:
                getEntry(definition.name.value, 'leaf');
                break;
        }
    });
    const implementations = new Map();
    types.forEach((entry, name) => {
        entry.interfaces.forEach((iface) => {
            implementations.set(iface, [...(implementations.get(iface) ?? []), name]);
        });
    });
    return { types, implementations };
};
/*
  Keeps the parts of an SDL document that `usage` names (type name → field names), plus what a valid schema needs around them:
  - the return type of a kept field, and the types of its arguments
  - every field of a kept input, since variables can set any of them
  - every member of a kept union and every implementation of a kept interface, since the endpoint can return any of them
  - the kept fields of an interface on each of its implementations
  - at least one field of each kept object and interface
*/
const pruneTypeDefs = (document, usage) => {
    const { types, implementations } = indexTypes(document);
    const keptTypes = new Set();
    const keptFields = new Map();
    const keepType = (typeName) => {
        const entry = types.get(typeName);
        if (!entry || keptTypes.has(typeName))
            return;
        keptTypes.add(typeName);
        if (entry.kind === 'fielded') {
            keptFields.set(typeName, new Set());
            entry.interfaces.forEach((iface) => {
                const interfaceFields = keptFields.get(iface);
                if (interfaceFields)
                    keepFields(typeName, [...interfaceFields]);
            });
            if (entry.isInterface)
                implementations.get(typeName)?.forEach(keepType);
        }
        else if (entry.kind === 'union') {
            entry.members.forEach(keepType);
        }
        else if (entry.kind === 'input') {
            entry.inputFields.forEach((field) => keepType(getNamedTypeName(field.type)));
        }
    };
    const keepFields = (typeName, fieldNames) => {
        keepType(typeName);
        const entry = types.get(typeName);
        const kept = keptFields.get(typeName);
        if (!entry || !kept)
            return;
        fieldNames.forEach((fieldName) => {
            const field = entry.fields.get(fieldName);
            if (!field || kept.has(fieldName))
                return;
            kept.add(fieldName);
            keepType(getNamedTypeName(field.type));
            field.arguments?.forEach((arg) => keepType(getNamedTypeName(arg.type)));
            if (entry.isInterface) {
                implementations.get(typeName)?.forEach((impl) => keepFields(impl, [fieldName]));
            }
        });
    };
    document.definitions.forEach((definition) => {
        if (definition.kind !== graphql_1.Kind.DIRECTIVE_DEFINITION)
            return;
        definition.arguments?.forEach((arg) => keepType(getNamedTypeName(arg.type)));
    });
    Object.entries(usage).forEach(([typeName, fieldNames]) => keepFields(typeName, fieldNames));
    // A type kept for a union, an interface or a return type still needs a field, so it gets the cheapest one
    const isLeaf = (typeName) => {
        // a built-in scalar has no definition in the document
        const kind = types.get(typeName)?.kind;
        return kind === undefined || kind === 'leaf';
    };
    const isCheap = (field) => isLeaf(getNamedTypeName(field.type)) &&
        !field.arguments?.some((arg) => arg.type.kind === graphql_1.Kind.NON_NULL_TYPE);
    let hasEmptyType = true;
    while (hasEmptyType) {
        hasEmptyType = false;
        keptFields.forEach((kept, typeName) => {
            if (kept.size > 0)
                return;
            const fields = [...types.get(typeName).fields.values()];
            const cheapest = fields.find(isCheap) ?? fields[0];
            if (!cheapest)
                return;
            keepFields(typeName, [cheapest.name.value]);
            hasEmptyType = true;
        });
    }
    const definitions = document.definitions.flatMap((definition) => {
        switch (definition.kind) {
            case graphql_1.Kind.DIRECTIVE_DEFINITION:
                return [definition];
            case graphql_1.Kind.OBJECT_TYPE_DEFINITION:
            case graphql_1.Kind.OBJECT_TYPE_EXTENSION:
            case graphql_1.Kind.INTERFACE_TYPE_DEFINITION:
            case graphql_1.Kind.INTERFACE_TYPE_EXTENSION: {
                const kept = keptFields.get(definition.name.value);
                if (!kept)
                    return [];
                const fields = definition.fields?.filter((field) => kept.has(field.name.value));
                const interfaces = definition.interfaces?.filter((iface) => keptTypes.has(iface.name.value));
                const isExtension = definition.kind === graphql_1.Kind.OBJECT_TYPE_EXTENSION ||
                    definition.kind === graphql_1.Kind.INTERFACE_TYPE_EXTENSION;
                if (isExtension &&
                    !fields?.length &&
                    !interfaces?.length &&
                    !definition.directives?.length) {
                    return [];
                }
                return [{ ...definition, fields, interfaces }];
            }
            case graphql_1.Kind.UNION_TYPE_DEFINITION:
            case graphql_1.Kind.UNION_TYPE_EXTENSION:
            case graphql_1.Kind.INPUT_OBJECT_TYPE_DEFINITION:
            case graphql_1.Kind.INPUT_OBJECT_TYPE_EXTENSION:
            case graphql_1.Kind.ENUM_TYPE_DEFINITION:
            case graphql_1.Kind.ENUM_TYPE_EXTENSION:
            case graphql_1.Kind.SCALAR_TYPE_DEFINITION:
            case graphql_1.Kind.SCALAR_TYPE_EXTENSION:
                return keptTypes.has(definition.name.value) ? [definition] : [];
            default:
                return [];
        }
    });
    return { ...document, definitions };
};
exports.default = pruneTypeDefs;
//# sourceMappingURL=pruneTypeDefs.js.map