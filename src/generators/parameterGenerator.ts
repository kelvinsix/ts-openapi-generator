
import * as ts from "typescript";
import { DecoratorType, processDecorators } from "../utils/decoratorUtil";
import { TypeSchema, TypeGenerator } from "./typeGenerator";
import { MetadataGenerator } from "./metadataGenerator";

export interface Parameter {
    name: string;
    where: string;
    schema: TypeSchema;
    wholeParam?: boolean;
    required?: boolean;
}

export class ParameterGenerator implements Parameter {
    name: string;
    where: string;
    schema: TypeSchema;
    wholeParam?: boolean;
    required?: boolean;

    constructor(private readonly node: ts.ParameterDeclaration, private readonly metadata: MetadataGenerator) {
        this.processDecorators();
    }

    public isValid(): boolean {
        return !!this.where;
    }

    public generate(): Parameter {
        this.name = this.name || this.node.name.getText();
        this.processTokens();
        return this;
    }

    private processDecorators(): void {
        processDecorators(this.node, this.metadata, decorator => {
            if (decorator.type == DecoratorType.Param || decorator.type == DecoratorType.Body) {
                this.name = decorator.arguments[0];
                this.where = decorator.options.paramIn;
                this.wholeParam = decorator.options.wholeParam;

                const type = this.metadata.typeChecker.getTypeFromTypeNode(this.node.type);
                this.schema = this.metadata.typeGenerator.getTypeSchema(type);
            }
        });
    }

    private processTokens() {
        if (this.node.initializer) {
            this.schema.default = this.metadata.typeGenerator.getInitializerValue(this.node.initializer);
        } else if (!this.node.questionToken) {
            this.required = true;
        }
    }
}
