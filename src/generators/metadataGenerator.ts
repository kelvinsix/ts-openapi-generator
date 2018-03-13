
import * as ts from "typescript";

import { ControllerGenerator, Controller } from "./controllerGenerator";

export class MetadataGenerator {
    private program: ts.Program;
    private typeChecker: ts.TypeChecker;
    controllers: Controller[] = []

    constructor(files: string[], options: ts.CompilerOptions) {
        this.program = ts.createProgram(files, options);
        this.typeChecker = this.program.getTypeChecker();
    }

    public generate(): void {
        for (const sourceFile of this.program.getSourceFiles()) {
            if (!sourceFile.isDeclarationFile) {
                sourceFile.forEachChild(this.walkNodeTree.bind(this));
            }
        }
    }

    /** True if this is visible outside this file, false otherwise */
    private isNodeExported(node: ts.Node): boolean {
        return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0
            || (!!node.parent && node.parent.kind === ts.SyntaxKind.SourceFile);
    }

    private walkNodeTree(node: ts.Node) {
        if (ts.isClassDeclaration(node) && node.name) {
            const symbol = this.typeChecker.getSymbolAtLocation(node.name);
            if (symbol) {
                const generator = new ControllerGenerator(node, this.typeChecker);
                if (generator.isValid()) {
                    this.controllers.push(generator.generate());
                }
            }
        } else if (ts.isModuleDeclaration(node)) {
            // This is a namespace, visit its children
            node.forEachChild(this.walkNodeTree.bind(this));
        }
    }
}