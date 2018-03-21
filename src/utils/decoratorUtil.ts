
import * as ts from "typescript";

export enum DecoratorType {
    Unknown,
    Controller,
    Action,
    Param,
    Body,
}

export interface DecoratorMetadata {
    decorator: ts.Decorator;
    type: DecoratorType;
    name: string;
    argument: string;
    paramIn?: string;
    wholeParam?: boolean;
}

export function processDecorators(node: ts.Node, typeChecker: ts.TypeChecker, cb: (decorator: DecoratorMetadata) => void) {
    if (!node.decorators || !node.decorators.length) {
        return;
    }

    function getName(decorator: ts.Decorator): string {
        const signature = typeChecker.getResolvedSignature(<ts.CallExpression>decorator.expression);
        const declaration = signature.getDeclaration() as ts.FunctionDeclaration;

        if (declaration.getSourceFile().fileName.indexOf('/routing-controllers/decorator/') == -1) {
            return;
        }

        return declaration.name.text;
    }

    function getType(name: string): DecoratorType {
        if (decoratorMap[name]) {
            let type = decoratorMap[name];
            return (type instanceof Array) ? type[0] : type;
        }
        return DecoratorType.Unknown;
    }

    function getArgument(decorator: ts.Decorator): string {
        const expression = <ts.CallExpression>decorator.expression;
        const args = expression.arguments;
        if (!args || !args.length) return;
        return ts.isStringLiteral(args[0]) ? (<ts.StringLiteral>args[0]).text : '';
    }

    node.decorators.forEach(decorator => {
        const name = getName(decorator);
        if (!name) return;
        const metadata: DecoratorMetadata = {
            decorator, name,
            type: getType(name),
            argument: getArgument(decorator)
        }
        if (metadata.type == DecoratorType.Param || metadata.type == DecoratorType.Body) {
            const [, where, isWhole ] = decoratorMap[name];
            metadata.paramIn = where;
            metadata.wholeParam = isWhole;
        }
        cb(metadata);
    });
}

const decoratorMap = {
    'Controller': DecoratorType.Controller,
    'JsonController': DecoratorType.Controller,
    'Get': DecoratorType.Action,
    'Put': DecoratorType.Action,
    'Post': DecoratorType.Action,
    'Delete': DecoratorType.Action,
    'Options': DecoratorType.Action,
    'Head': DecoratorType.Action,
    'Patch': DecoratorType.Action,
    'Param': [DecoratorType.Param, 'path', false],
    'QueryParam': [DecoratorType.Param, 'query', false],
    'QueryParams': [DecoratorType.Param, 'query', true],
    'HeaderParam': [DecoratorType.Param, 'header', false],
    'HeaderParams': [DecoratorType.Param, 'header', true],
    'CookieParam': [DecoratorType.Param, 'cookie', false],
    'CookieParams': [DecoratorType.Param, 'cookie', true],
    'BodyParam': [DecoratorType.Body, 'body', false],
    'Body': [DecoratorType.Body, 'body', true],
};
