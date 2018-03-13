
import * as ts from "typescript";
import { Method, MethodGenerator } from "./methodGenerator";
import { DecoratorType, processDecorators } from "../utils/decoratorUtil";

export interface Controller {
    name: string;
    route: string;
    methods: Method[];
}

export class ControllerGenerator implements Controller {
    name: string;
    route: string;
    methods: Method[] = [];

    constructor(private readonly node: ts.ClassDeclaration, private readonly typeChecker: ts.TypeChecker) {
        this.processDecorators();
    }

    public isValid(): boolean {
        return !!this.route;
    }

    public generate(): Controller {
        this.name = this.node.name.text;

        if (this.node.members && this.node.members.length) {
            this.node.members.filter(m => ts.isMethodDeclaration(m)).forEach((member: ts.MethodDeclaration) => {
                const generator = new MethodGenerator(member, this.typeChecker);
                if (generator.isValid()) {
                    this.methods.push(generator.generate());
                }
            });
        }
        return this;
    }

    private processDecorators() {
        processDecorators(this.node, this.typeChecker, decorator => {
            switch (decorator.type) {
                case DecoratorType.Controller:
                    if (this.route) throw new Error(`Encountered multiple route decorator in '${this.node.name!.text}' controller`);
                    this.route = decorator.argument;
            }
        })
    }
}
