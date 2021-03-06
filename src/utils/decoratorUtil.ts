
import * as ts from "typescript";
import { MetadataGenerator } from "../generators/metadataGenerator";

export enum DecoratorType {
    Unknown,
    Controller,
    Action,
    Param,
    Body,
    File,
    Authorization,
    Exclude,
    Expose,
}

export interface DecoratorMetadata {
    name: string;
    package: string;
    type: DecoratorType;
    options?: DecoratorOptions;
    arguments?: any[];
}

export interface DecoratorOptions {
    mediaType?: string;
    paramIn?: string;
    wholeParam?: boolean;
}

export function processDecorators(node: ts.Node, metadata: MetadataGenerator, cb: (decorator: DecoratorMetadata) => void) {
    if (!node.decorators || !node.decorators.length) {
        return;
    }

    const typeChecker = metadata.typeChecker;
    const sourceFileToPackageName: ts.Map<string> = (<any>metadata.program).sourceFileToPackageName

    class Decorator implements DecoratorMetadata {
        name: string;
        package: string;
        type: DecoratorType;
        options: DecoratorOptions;
        arguments: any[] = [];

        constructor(private readonly node: ts.Decorator) {
            const signature = typeChecker.getResolvedSignature(<ts.CallExpression>node.expression);
            const declaration = signature.getDeclaration() as ts.FunctionDeclaration;
            const fileName = declaration.getSourceFile().fileName;
            this.name = declaration.name.text;
            this.package = sourceFileToPackageName.get(ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase());
            this.findDecorator();
            this.setArguments();
        }

        private findDecorator() {
            for (const d of knownDecorators) {
                if (d.name === this.name && d.package === this.package) {
                    this.type = d.type;
                    this.options = d.options || {};
                    return;
                }
            }
            this.type = DecoratorType.Unknown;
            // const sourceFile = this.node.getSourceFile();
            // const pos = sourceFile.getLineAndCharacterOfPosition(this.node.getStart(sourceFile));
            // console.info(`Decorator: ${this.package}.${this.name}: ${sourceFile.fileName}(${pos.line+1},${pos.character+1})`);
        }

        private setArguments() {
            const expression = <ts.CallExpression>this.node.expression;
            const args = expression.arguments;
            if (!args || !args.length) return;

            for (const argNode of args) {
                if (ts.isStringLiteral(argNode)) {
                    this.arguments.push(argNode.text);
                }
            }
        }
    }

    node.decorators.forEach(decorator => {
        const metadata = new Decorator(decorator);
        cb(metadata);
    });
}

const knownDecorators: Array<DecoratorMetadata> = [
    {
        package: 'routing-controllers',
        name: 'Controller',
        type: DecoratorType.Controller,
        options: {
            mediaType: '*/*',
        }
    }, {
        package: 'routing-controllers',
        name: 'JsonController',
        type: DecoratorType.Controller,
        options: {
            mediaType: 'application/json',
        }
    }, {
        package: 'routing-controllers',
        name: 'Get',
        type: DecoratorType.Action,
    }, {
        package: 'routing-controllers',
        name: 'Put',
        type: DecoratorType.Action,
    }, {
        package: 'routing-controllers',
        name: 'Post',
        type: DecoratorType.Action,
    }, {
        package: 'routing-controllers',
        name: 'Delete',
        type: DecoratorType.Action,
    }, {
        package: 'routing-controllers',
        name: 'Options',
        type: DecoratorType.Action,
    }, {
        package: 'routing-controllers',
        name: 'Head',
        type: DecoratorType.Action,
    }, {
        package: 'routing-controllers',
        name: 'Patch',
        type: DecoratorType.Action,
    }, {
        package: 'routing-controllers',
        name: 'Param',
        type: DecoratorType.Param,
        options: {
            paramIn: 'path'
        }
    }, {
        package: 'routing-controllers',
        name: 'QueryParam',
        type: DecoratorType.Param,
        options: {
            paramIn: 'query'
        }
    }, {
        package: 'routing-controllers',
        name: 'QueryParams',
        type: DecoratorType.Param,
        options: {
            paramIn: 'query',
            wholeParam: true
        }
    }, {
        package: 'routing-controllers',
        name: 'HeaderParam',
        type: DecoratorType.Param,
        options: {
            paramIn: 'header'
        }
    }, {
        package: 'routing-controllers',
        name: 'HeaderParams',
        type: DecoratorType.Param,
        options: {
            paramIn: 'header',
            wholeParam: true
        }
    }, {
        package: 'routing-controllers',
        name: 'CookieParam',
        type: DecoratorType.Param,
        options: {
            paramIn: 'cookie'
        }
    }, {
        package: 'routing-controllers',
        name: 'CookieParams',
        type: DecoratorType.Param,
        options: {
            paramIn: 'cookie',
            wholeParam: true
        }
    }, {
        package: 'routing-controllers',
        name: 'BodyParam',
        type: DecoratorType.Param,
        options: {
            paramIn: 'body'
        }
    }, {
        package: 'routing-controllers',
        name: 'Body',
        type: DecoratorType.Param,
        options: {
            paramIn: 'body',
            wholeParam: true
        }
    }, {
        package: 'routing-controllers',
        name: 'UploadedFile',
        type: DecoratorType.File,
        options: {
            mediaType: 'multipart/form-data',
            paramIn: 'body'
        }
    }, {
        package: 'routing-controllers',
        name: 'UploadedFiles',
        type: DecoratorType.File,
        options: {
            mediaType: 'multipart/form-data',
            paramIn: 'body',
            wholeParam: true
        }
    }, {
        package: 'routing-controllers',
        name: 'Authorized',
        type: DecoratorType.Authorization,
    }, {
        package: 'class-transformer',
        name: 'Exclude',
        type: DecoratorType.Exclude,
    }, {
        package: 'class-transformer',
        name: 'Expose',
        type: DecoratorType.Expose,
    }
]
