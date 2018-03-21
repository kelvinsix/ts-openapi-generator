
import * as ts from "typescript";
import { DecoratorType, processDecorators } from "../utils/decoratorUtil";
import { TypeSchema, TypeGenerator } from "./typeGenerator";
import { MetadataGenerator } from "./metadataGenerator";

export interface Parameter {
    name: string;
    where: string;
    schema: TypeSchema;
    wholeParam?: boolean;
}

export class ParameterGenerator implements Parameter {
    name: string;
    where: string;
    schema: TypeSchema;
    wholeParam?: boolean;

    constructor(private readonly node: ts.ParameterDeclaration, private readonly metadata: MetadataGenerator) {
        this.processDecorators();
    }

    public isValid(): boolean {
        return !!this.where;
    }

    public generate(): Parameter {
        this.name = this.name || this.node.name.getText();
        return this;
    }

    private processDecorators(): void {
        processDecorators(this.node, this.metadata.typeChecker, decorator => {
            if (decorator.type == DecoratorType.Param || decorator.type == DecoratorType.Body) {
                this.name = decorator.argument;
                this.where = decorator.paramIn;
                this.wholeParam = decorator.wholeParam;

                const type = this.metadata.typeChecker.getTypeFromTypeNode(this.node.type);
                this.schema = this.metadata.typeGenerator.getTypeSchema(type);
            }
        });
    }
}
