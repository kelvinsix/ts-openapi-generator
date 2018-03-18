#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";
import * as ts from "typescript";
import { ArgumentParser } from "argparse";
import { Config, CommandLineArgs } from "./types";
import { MetadataGenerator } from "./generators/metadataGenerator";
import { SwaggerSpecBuilder } from "./builders/swaggerSpecBuilder";

function getPackageJsonValue(basePath: string, key: string, defaultValue = ''): string {
    try {
        const packageJson = require(`${basePath}/package.json`);
        return packageJson[key] || defaultValue;
    } catch (err) {
        return defaultValue;
    }
};

function loadConfig(fileName: string, basePath: string): Config {
    let config: Config;
    try {ts.sys.readFile
        config = require(fileName);
    } catch (err) {
        throw new Error("Error loading config file");
    }

    const info = config.info;
    info.title = info.title || getPackageJsonValue(basePath, 'name');
    info.version = info.version || getPackageJsonValue(basePath, 'version');
    info.description = info.description || getPackageJsonValue(basePath, 'description');
    config.outputFile = config.outputFile || `${basePath}/openapi.json`;
    if (!info.title || !info.version) {
        throw new Error('Missing required field');
    }

    return config;
}

function loadProject(fileName: string, basePath: string): ts.ParsedCommandLine {
    const jsonFile = ts.readJsonConfigFile(fileName, ts.sys.readFile);
    const result = ts.parseJsonSourceFileConfigFileContent(jsonFile, ts.sys, basePath);
    result.options.noEmit = true;
    return result;
}

function parseCommandLine(): CommandLineArgs {
    const parser = new ArgumentParser();
    parser.addArgument([], {
        metavar: 'file',
        dest: 'fileNames',
        required: false,
        nargs: '*'
    });
    parser.addArgument(['-d', '--directory'], {
        dest: 'workingDir',
        help: 'working directory'
    });
    parser.addArgument(['-c', '--config'], {
        defaultValue: 'ts-openapi-generator.json',
        help: "config file, default is 'ts-openapi-generator.json'"
    });
    parser.addArgument(['-p', '--project'], {
        defaultValue: 'tsconfig.json',
        help: "TypeScript project file, default is 'tsconfig.json'"
    });
    const args: CommandLineArgs = parser.parseArgs();
    console.log(args);

    if (args.workingDir) {
        if (args.config.match('[\/]')) {
            throw new Error("can't set working dir with a specific config file")
        }
        if (args.project.match('[\/]')) {
            throw new Error("can't set working dir with a specific project file")
        }
        if (!ts.sys.directoryExists(args.workingDir)) {
            throw new Error(`directory ${args.workingDir} not exist`)
        }
        args.workingDir = path.resolve(args.workingDir);
    } else if (args.project) {
        args.workingDir = path.resolve(path.dirname(args.project));
    } else {
        args.workingDir = process.cwd();
    }

    function resolvePath(fileName: string): string {
        fileName = path.normalize(fileName);
        if (!path.isAbsolute(fileName))
            fileName = path.join(args.workingDir, fileName);
        return fileName;
    }

    args.config = resolvePath(args.config);
    args.project = resolvePath(args.project);

    return args;
}

function main() {
    const args = parseCommandLine();

    let fileNames: string[] = args.fileNames;
    let compileOptions: ts.CompilerOptions = {
        noEmit: true,
        experimentalDecorators: true,
        target: ts.ScriptTarget.ES2015,
        module: ts.ModuleKind.CommonJS,
    };

    const config = loadConfig(args.config, args.workingDir);

    if (fileNames.length === 0) {
        fileNames = config.files;
    }

    if (!fileNames || fileNames.length === 0) {
        if (!ts.sys.fileExists(args.project)) {
            throw new Error('No specified files or tsconfig.json file')
        }

        try {
            const project = loadProject(args.project, args.workingDir);
            compileOptions = project.options;
            fileNames = project.fileNames;
        } catch (err) {
            throw new Error('no files')
        }
    } else {
        fileNames = fileNames.reduce((all, file) => {
            return all.concat(glob.sync(file, { nodir: true }));
        }, []);
    }

    const metadata = new MetadataGenerator(fileNames, compileOptions);
    metadata.generate();
    const specBuilder = new SwaggerSpecBuilder(metadata, config);

    const specString = path.extname(config.outputFile) === '.yaml' ? specBuilder.getSpecAsYaml() : specBuilder.getSpecAsJson(undefined, config.indent);
    fs.writeFileSync(config.outputFile, specString, { encoding: 'utf8' });
}

main();
