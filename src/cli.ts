#!/usr/bin/env node
import * as fs from "fs";
import * as glob from "glob";
import * as ts from "typescript";
import { MetadataGenerator } from "./generators/metadataGenerator";
import { SwaggerSpecBuilder } from "./builders/swaggerSpecBuilder";
import { Config } from "./config";
import { extname } from "path";

const workingDir: string = process.cwd();

function getPackageJsonValue(key: string, defaultValue = ''): string {
    try {
        const packageJson = require(`${workingDir}/package.json`);
        return packageJson[key] || defaultValue;
    } catch (err) {
        return defaultValue;
    }
};

function loadConfig(path: string): Config {
    let config: Config;
    try {
        config = require(`${workingDir}/${path}`);
    } catch (err) {
        throw new Error("Error loading config file");
    }

    const info = config.info;
    info.title = info.title || getPackageJsonValue('name');
    info.version = info.version || getPackageJsonValue('version');
    info.description = info.description || getPackageJsonValue('description');
    config.outputFile = config.outputFile || `${workingDir}/openapi.json`;
    if (!info.title || !info.version) {
        throw new Error('Missing required field');
    }

    return config;
}

function main(args) {
    const config = loadConfig('ts-openapi-generator.json');
    const files = args;

    const metadata = new MetadataGenerator(files.reduce((all, file) => {
        return all.concat(glob.sync(file, { nodir: true }));
    }, []), {
        target: ts.ScriptTarget.ES2015,
        module: ts.ModuleKind.CommonJS,
    });
    metadata.generate();
    const specBuilder = new SwaggerSpecBuilder(metadata, config);

    const specString = extname(config.outputFile) === '.yaml' ? specBuilder.getSpecAsYaml() : specBuilder.getSpecAsJson(undefined, config.indent);
    fs.writeFileSync(config.outputFile, specString, { encoding: 'utf8' });
}

main(process.argv.slice(2));
