
import * as ts from "typescript";
import { DecoratorType, processDecorators } from "../utils/decoratorUtil";

interface Route {
    method: string;
    route: string;
}
export interface Method {
    name: string;
    routes: Route[];
    summary?: string;
    description?: string;
}

export class MethodGenerator implements Method {
    name: string;
    routes = [];
    summary: string;
    description: string;

    constructor(private readonly node: ts.MethodDeclaration, private readonly typeChecker: ts.TypeChecker) {
        this.processDecorators();
    }

    public isValid() {
        return this.routes && this.routes.length;
    }

    public generate(): Method {
        this.name = (this.node.name as ts.Identifier).text;
        this.processJSDocs();
        return this;
    }

    private processDecorators() {
        processDecorators(this.node, this.typeChecker, decorator => {
            switch (decorator.type) {
                case DecoratorType.Action:
                    this.routes.push({
                        method: decorator.name.toLowerCase(),
                        route: decorator.argument
                    });
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
}
