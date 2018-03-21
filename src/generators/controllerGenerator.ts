
import * as ts from "typescript";
import { Method, MethodGenerator } from "./methodGenerator";
import { DecoratorType, processDecorators } from "../utils/decoratorUtil";
import { MetadataGenerator } from "./metadataGenerator";

export interface Controller {
    name: string;
    route: string;
    description?: string;
    methods: Method[];
}

export class ControllerGenerator implements Controller {
    name: string;
    route: string;
    description: string;
    methods: Method[] = [];

    constructor(private readonly node: ts.ClassDeclaration, private readonly metadata: MetadataGenerator) {
        this.processDecorators();
    }

    public isValid(): boolean {
        return !!this.route;
    }

    public generate(): Controller {
        this.name = this.node.name.text;
        this.processJSDocs();
        this.processMethods();
        return this;
    }

    private processDecorators() {
        processDecorators(this.node, this.metadata.typeChecker, decorator => {
            switch (decorator.type) {
                case DecoratorType.Controller:
                    if (this.route) throw new Error(`Encountered multiple route decorator in '${this.node.name!.text}' controller`);
                    this.route = decorator.argument;
            }
        })
    }

    private processJSDocs() {
        const jsDocs: ts.JSDoc[] = (this.node as any).jsDoc;
        if (!jsDocs || jsDocs.length === 0) return;

        const jsDoc = jsDocs[0];
        this.description = jsDoc.comment;

        // TODO: process tags
    }

    private processMethods() {
        if (this.node.members && this.node.members.length) {
            this.node.members.filter(m => ts.isMethodDeclaration(m)).forEach((member: ts.MethodDeclaration) => {
                const generator = new MethodGenerator(member, this.metadata);
                if (generator.isValid()) {
                    this.methods.push(generator.generate());
                }
            });
        }
    }
}
