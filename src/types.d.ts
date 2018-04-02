
interface InfoConfig {
    title?: string;
    version?: string;
    description?: string;
}

interface ServerConfig {
    url: string;
    description?: string;
}

interface SecurityScheme {
    type: string;
    description?: string;
    name?: string;
    in?: string;
    scheme?: string;
    bearerFormat?: string;
}

export interface SecurityRequirements {
    [name: string]: string[];
}

export interface Config {
    info: InfoConfig
    servers?: ServerConfig[];
    securitySchemes?: {
        [name: string]: SecurityScheme;
    };
    securityTemplates?: {
        [name: string]: SecurityRequirements;
    };
    outputFile?: string;
    indent?: string | number;
    files?: string[];
}

export interface CommandLineArgs {
    fileNames: string[];
    workingDir?: string;
    project?: string;
    config?: string;
}
