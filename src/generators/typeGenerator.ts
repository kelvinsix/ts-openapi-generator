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
    maximum?: any;
    exclusiveMaximum?: number;
    minimum?: number;
    exclusiveMinimum?: number;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    maxItems?: number;
    minItems?: number;
    uniqueItems?: boolean;
    maxProperties?: number;
    minProperties?: number;
    required?: string[];
    enum?: PrimitiveType[] | TypeSchema[];
}

const PrimitiveTypeFlags = ts.TypeFlags.Number | ts.TypeFlags.Boolean | ts.TypeFlags.String | ts.TypeFlags.Null;

export class TypeGenerator {
    reffedSchemas: { [key: string]: TypeSchema };

    constructor(private readonly typeChecker: ts.TypeChecker) {
    }

    public getTypeSchema(type: ts.Type): TypeSchema {
        const schema: TypeSchema = {};
        let returnSchema = schema;

        if (type.flags & ts.TypeFlags.Union) {
            this.getUnionTypeSchema(<ts.UnionType>type, schema);
        } else if (!type.symbol) {
            this.getPrimitiveTypeSchema(type, schema);
        } else if (type.flags & ts.TypeFlags.Object) {
            this.getClassTypeSchema(<ts.ObjectType>type, schema);
        } else {
            throw new NotImplementedError('Unknown type ' + this.typeChecker.typeToString(type));
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

        for (const subType of unionType.types) {
            let value;
            if (subType.flags & ts.TypeFlags.StringOrNumberLiteral) {
                value = (<ts.LiteralType>subType).value;
            } else {
                throw new NotImplementedError('Unknown type ' + this.typeChecker.typeToString(subType));
            }

            if (literalValues.indexOf(value) === -1) {
                literalValues.push(value);
            }
        }

        if (literalValues.every(x => typeof x === 'string')) {
            schema.type = 'string';
        } else if (literalValues.every(x => typeof x === 'number')) {
            schema.type = 'number';
        } else {
            throw new NotSupportedError('Multiple type not supported at ' + this.typeChecker.typeToString(unionType));
        }

        schema.enum = literalValues.sort();
    }

    private getClassTypeSchema(type: ts.ObjectType, schema: TypeSchema) {
        schema.type = 'object';
        schema.properties = {};
        const typeDefNode = <ts.ClassDeclaration>type.symbol.declarations[0];
        const props = this.typeChecker.getPropertiesOfType(type);

        if (props.length) {
            for (const prop of props) {
                const subType = this.typeChecker.getTypeOfSymbolAtLocation(prop, typeDefNode);
                const subSchema = schema.properties[prop.name] = this.getTypeSchema(subType)

                const comments = prop.getDocumentationComment(this.typeChecker);
                if (comments.length) {
                    subSchema.description = ts.displayPartsToString(comments).trim();
                }

                const propDeclNode = <ts.PropertyDeclaration>prop.declarations[0];
                if (!ts.isPropertyDeclaration(propDeclNode)) {
                    throw new NotImplementedError('Unknown property ' + prop.name);
                } else if (!propDeclNode.questionToken) {
                    if (!schema.required) {
                        schema.required = [];
                    }
                    schema.required.push(prop.name);
                }
            }
        } else {
            throw new NotImplementedError('no members in class declaration');
        }
    }
}
