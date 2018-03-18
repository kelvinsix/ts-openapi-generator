
interface InfoConfig {
    title?: string;
    version?: string;
    description?: string;
}

interface ServerConfig {
    url: string;
    description?: string;
}

export interface Config {
    info: InfoConfig
    servers?: ServerConfig[];
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
