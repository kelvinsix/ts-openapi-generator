import * as ts from "typescript";
import { NotImplementedError, NotSupportedError } from "../utils/error";

type PrimitiveType = number | boolean | string | null;

export interface TypeSchema {
    $ref?: string;
    type?: string;
    allOf?: TypeSchema[];
    oneOf?: TypeSchema[];
    anyOf?: TypeSchema[];
    not?: TypeSchema[];
    items?: TypeSchema;
    properties?: {
        [name: string]: TypeSchema;
    };
    additionalProperties?: TypeSchema;
    description?: string;
    format?: string;
    default?: PrimitiveType | Object;

    title?: string;
    multipleOf?: number;
    maximum?: number;
    exclusiveMaximum?: boolean;
    minimum?: number;
    exclusiveMinimum?: boolean;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    maxItems?: number;
    minItems?: number;
    uniqueItems?: boolean;
    maxProperties?: number;
    minProperties?: number;
    required?: string[];
    enum?: PrimitiveType[]; // complex type is not implemented
}

const PrimitiveTypeFlags = ts.TypeFlags.Number | ts.TypeFlags.Boolean | ts.TypeFlags.String | ts.TypeFlags.Null;

export class TypeSchemaMap {
    private schemas: { [id: number]: TypeSchema } = {};
    private idToName: { [id: number]: string } = {};
    private nameToId: { [name: string]: number } = {};

    get(type: ts.Type): TypeSchema {
        const id = (type as any).id as number;
        return this.schemas[id];
    }
    set(type: ts.Type, schema: TypeSchema): TypeSchema {
        const id = (type as any).id as number;
        return this.schemas[id] = schema;
    }

    byRef(ref: string): TypeSchema {
        const id = this.nameToId[ref.match(/^\#\/components\/schemas\/(.+)$/)[1]];
        return this.schemas[id];
    }

    /** helper for map iteration */
    [Symbol.iterator] = function*(): IterableIterator<[string, TypeSchema]> {
        for (const id in this.schemas) {
            if (this.schemas.hasOwnProperty(id)) {
                yield [this.idToName[id], this.schemas[id]];
            }
        }
    }

    /** Gets/generates a globally unique type name for the given type */
    public getTypeName(type: ts.Type, typeChecker: ts.TypeChecker) {
        const id = (type as any).id as number;
        if (this.idToName[id]) { // Name already assigned?
            return this.idToName[id];
        }

        const baseName = typeChecker.typeToString(type, undefined, ts.TypeFormatFlags.UseFullyQualifiedType);
        let name = baseName;
        if (this.nameToId[name]) { // If a type with same name exists
            for (let i = 1; true; ++i) { // Try appending "_1", "_2", etc.
                name = `${baseName}_${i}`;
                if (!this.nameToId[name]) {
                    break;
                }
            }
        }

        this.idToName[id] = name;
        this.nameToId[name] = id;
        return name;
    }
}

export class TypeGenerator {
    reffedSchemas = new TypeSchemaMap();

    constructor(private readonly typeChecker: ts.TypeChecker) {
    }

    public getTypeSchema(type: ts.Type, schema: TypeSchema = {}): TypeSchema {
        let returnSchema = schema;

        let asRef = true;
        if (!type.symbol || (type.flags & ts.TypeFlags.Object && (<ts.ObjectType>type).objectFlags & ts.ObjectFlags.Anonymous)) {
            asRef = false;
        } else if (type.flags & ts.TypeFlags.Object && (<ts.ObjectType>type).objectFlags & ts.ObjectFlags.Reference
            && (<ts.TypeReference>type).typeArguments && (<ts.TypeReference>type).typeArguments.length) {
            // don't reference to a generic type
            asRef = false;
        } else {
            returnSchema = {
                $ref:  `#/components/schemas/${this.reffedSchemas.getTypeName(type, this.typeChecker)}`,
            };
        }

        if (!asRef || !this.reffedSchemas.get(type)) {
            if (asRef) {
                this.reffedSchemas.set(type, schema);
            }

            if (!type.symbol) {
                if (type.flags & (PrimitiveTypeFlags | ts.TypeFlags.Literal)) {
                    this.getPrimitiveTypeSchema(type, schema);
                } else if (type.flags & ts.TypeFlags.Union) {
                    this.getUnionTypeSchema(<ts.UnionType>type, schema);
                } else if (type.flags & ts.TypeFlags.Void) {
                    schema.type = undefined;
                } else if (type.flags & ts.TypeFlags.Intersection) {
                    this.getIntersectionTypeSchema(<ts.IntersectionType>type, schema);
                } else if (type.flags & ts.TypeFlags.Object && (<ts.ObjectType>type).objectFlags & ts.ObjectFlags.Reference) {
                    this.getTupleTypeSchema(<ts.TypeReference>type, schema);
                } else {
                    throw new NotImplementedError('Unknown type ' + this.typeChecker.typeToString(type));
                }
            } else if (type.flags & ts.TypeFlags.Object) {
                if ((<ts.ObjectType>type).objectFlags & (ts.ObjectFlags.Reference | ts.ObjectFlags.Anonymous)) {
                    returnSchema = this.getClassTypeSchema(<ts.TypeReference>type, schema) || returnSchema;
                } else if ((<ts.ObjectType>type).objectFlags & ts.ObjectFlags.Interface && this.typeChecker.typeToString(type) === 'Date') {
                    schema.type = 'string';
                    schema.format = 'date-time';
                } else {
                    throw new NotImplementedError('Unknown type ' + this.typeChecker.typeToString(type));
                }
            } else {
                throw new NotImplementedError('Unknown type ' + this.typeChecker.typeToString(type));
            }
        }

        return returnSchema;
    }

    private getPrimitiveTypeSchema(type: ts.Type, schema: TypeSchema) {
        if (type.flags & PrimitiveTypeFlags) {
            schema.type = (<any>type).intrinsicName;
        } else if (type.flags & ts.TypeFlags.StringOrNumberLiteral) {
            const value = (<ts.LiteralType>type).value;
            schema.type = typeof value;
            schema.enum = [ value ];
            schema.default = value;
        } else {
            throw new NotImplementedError('Unknown type ' + this.typeChecker.typeToString(type));
        }
    }

    private getUnionTypeSchema(unionType: ts.UnionType, schema: TypeSchema) {
        const literalValues: PrimitiveType[] = [];
        const schemas: TypeSchema[] = [];

        for (const subType of unionType.types) {
            let value;
            if (subType.flags & ts.TypeFlags.StringOrNumberLiteral) {
                value = (<ts.LiteralType>subType).value;
                if (literalValues.indexOf(value) === -1) {
                    literalValues.push(value);
                }
            } else {
                const subSchema = this.getTypeSchema(subType);
                schemas.push(subSchema);
            }
        }

        if (literalValues.length) {
            let type;
            if (literalValues.every(x => typeof x === 'string')) {
                type = 'string';
            } else if (literalValues.every(x => typeof x === 'number')) {
                type = 'number';
            } else {
                throw new NotSupportedError('Multiple type not supported at ' + this.typeChecker.typeToString(unionType));
            }
            schemas.push({ type, enum: literalValues.sort() });
        }

        if (schemas.length === 1) {
            for (const key in schemas[0]) {
                if (schemas[0].hasOwnProperty(key)) {
                    schema[key] = schemas[0][key];
                }
            }
        } else {
            schema.anyOf = schemas;
        }
    }

    private getTupleTypeSchema(type: ts.TypeReference, schema: TypeSchema) {
        const subType = type.typeArguments[0];
        if (!type.typeArguments.length || !type.typeArguments.every(st => st === subType)) {
            throw new NotSupportedError('Multiple type in tuple is not support, ' + this.typeChecker.typeToString(type));
        }

        schema.type = "array";
        schema.items = this.getTypeSchema(subType);
        schema.minItems = schema.maxItems = type.typeArguments.length;
    }

    private getIntersectionTypeSchema(type: ts.IntersectionType, schema: TypeSchema) {
        schema.allOf = [];
        for (const subType of type.types) {
            schema.allOf.push(this.getTypeSchema(subType));
        }
    }

    private getClassTypeSchema(type: ts.TypeReference, schema: TypeSchema): TypeSchema | undefined {
        if (type.typeArguments && type.typeArguments.length) {
            return this.getGenericTypeSchema(type, schema);
        }

        schema.type = 'object';
        schema.properties = {};

        const typeDefNode = type.symbol.declarations ? type.symbol.declarations[0] : undefined;
        const props = this.typeChecker.getPropertiesOfType(type);

        if (props.length) {
            for (const prop of props) {
                if (prop.flags & ts.SymbolFlags.Method) {
                    // skip it
                } else if (prop.flags & ts.SymbolFlags.Property) {
                    const subType = this.typeChecker.getTypeOfSymbolAtLocation(prop, typeDefNode);
                    const subSchema = schema.properties[prop.name] = this.getTypeSchema(subType)

                    const comments = prop.getDocumentationComment(this.typeChecker);
                    if (comments.length) {
                        subSchema.description = ts.displayPartsToString(comments).trim();
                    }

                    const propDeclNode = <ts.PropertyDeclaration>prop.declarations[0];
                    if (!propDeclNode.questionToken) {
                        if (!schema.required) {
                            schema.required = [];
                        }
                        schema.required.push(prop.name);
                    }
                } else {
                    throw new NotImplementedError('Unknown symbol ' + prop.name);
                }
            }
        } else if (!(type.symbol.flags & ts.SymbolFlags.TypeLiteral)) {
            throw new NotImplementedError('no members in class declaration');
        }
    }

    private getGenericTypeSchema(type: ts.TypeReference, schema: TypeSchema): TypeSchema | undefined {
        if (type.symbol.name === 'Promise' && type.typeArguments.length === 1) {
            return this.getTypeSchema(type.typeArguments[0], schema);
        } else if (type.symbol.name === 'Array' && type.typeArguments.length === 1) {
            schema.type = 'array';
            schema.items = this.getTypeSchema(type.typeArguments[0]);
        } else if (type.symbol.name === 'Map' && type.typeArguments.length === 2) {
            schema.type = 'object';
            schema.properties = {};
            schema.additionalProperties = this.getTypeSchema(type.typeArguments[1]);
            // need handle 'K' type?
        } else {
            throw new NotImplementedError('Unknown generic type ' + this.typeChecker.typeToString(type));
        }
    }
}
