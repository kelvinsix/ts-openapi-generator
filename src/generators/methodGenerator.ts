
import * as ts from "typescript";
import { DecoratorType, DecoratorOptions, processDecorators } from "../utils/decoratorUtil";
import { ParameterGenerator, Parameter } from "./parameterGenerator";
import { MetadataGenerator } from "./metadataGenerator";
import { TypeSchema } from "./typeGenerator";

interface Route {
    method: string;
    route: string;
}
export interface Method {
    name: string;
    routes: Route[];
    summary?: string;
    description?: string;
    parameters: Parameter[];
    returnSchema: TypeSchema
    options?: DecoratorOptions;
    authorization?: string;
}

export class MethodGenerator implements Method {
    name: string;
    routes = [];
    summary: string;
    description: string;
    parameters: Parameter[] = [];
    returnSchema: TypeSchema;
    options: DecoratorOptions;
    authorization?: string;

    constructor(private readonly node: ts.MethodDeclaration, private readonly metadata: MetadataGenerator) {
        this.processDecorators();
    }

    public isValid() {
        return this.routes && this.routes.length;
    }

    public generate(): Method {
        this.name = (this.node.name as ts.Identifier).text;
        this.processParameters();
        this.processReturnType();
        this.processJSDocs();
        return this;
    }

    private processDecorators() {
        processDecorators(this.node, this.metadata, decorator => {
            if (decorator.type === DecoratorType.Action) {
                this.routes.push({
                    method: decorator.name.toLowerCase(),
                    route: decorator.arguments[0]
                });
                this.options = decorator.options;
            } else if (decorator.type === DecoratorType.Authorization) {
                this.authorization = decorator.arguments[0] || '';
            }
        });
    }

    private processJSDocs() {
        const jsDocs: ts.JSDoc[] = (this.node as any).jsDoc;
        if (!jsDocs || jsDocs.length === 0) return;

        const jsDoc = jsDocs[0];
        // TODO: set as description when @summery tag exist
        this.summary = jsDoc.comment;

        // TODO: process tags
    }

    private processParameters() {
        this.node.parameters.filter(m => ts.isParameter(m)).forEach((parameter: ts.ParameterDeclaration) => {
            const generator = new ParameterGenerator(parameter, this.metadata);
            if (generator.isValid()) {
                this.parameters.push(generator.generate());
            }
        });
    }

    private processReturnType() {
        const type = this.metadata.typeChecker.getTypeFromTypeNode(this.node.type);
        this.returnSchema = this.metadata.typeGenerator.getTypeSchema(type);
    }
}
