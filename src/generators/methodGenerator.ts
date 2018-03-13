
import * as ts from "typescript";
import { DecoratorType, processDecorators } from "../utils/decoratorUtil";

interface Route {
    method: string;
    route: string;
}
export interface Method {
    routes: Route[];
}

export class MethodGenerator implements Method {
    routes = [];

    constructor(private readonly node: ts.MethodDeclaration, private readonly typeChecker: ts.TypeChecker) {
        this.processDecorators();
    }

    public isValid() {
        return this.routes && this.routes.length;
    }

    public generate(): Method {
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
}
