
import * as oa from "openapi3-ts";
import { OpenApiBuilder } from "./openApiBuilder";
import { Config, SecurityRequirements } from "../types";
import { MetadataGenerator } from "../generators/metadataGenerator";
import { Controller } from "../generators/controllerGenerator";
import { TypeSchema } from "../generators/typeGenerator";

export class SwaggerSpecBuilder extends OpenApiBuilder {
    constructor(private readonly metadata: MetadataGenerator, private readonly config: Config) {
        super();
    }

    public getSpec(): oa.OpenAPIObject {
        const { info, servers, securitySchemes, securityTemplates } = this.config;
        this.addTitle(info.title).addVersion(info.version);
        if (info.description) this.addDescription(info.description);
        if (servers && servers.length) {
            servers.forEach(s => this.addServer(s));
        }
        if (securitySchemes && securityTemplates) {
            for (const name in securitySchemes) {
                if (securitySchemes.hasOwnProperty(name)) {
                    this.addSecurityScheme(name, securitySchemes[name]);
                }
            }
            if (securityTemplates[''] === undefined) {
                throw new Error('securityTemplte must have default template in config file');
            }
        }

        this.metadata.controllers.forEach(controller => {
            let controllerName = controller.name.replace(/controller$/i, '');
            if (controller.description) {
                this.addTag({
                    name: controllerName,
                    description: controller.description
                });
            }

            controller.methods.forEach(method => {
                const paramObjs: oa.ParameterObject[] = [];
                let requestBody: oa.RequestBodyObject;
                let security: SecurityRequirements = undefined;
                if (securityTemplates) {
                    const securityName = method.authorization !== undefined ? method.authorization : controller.authorization !== undefined ? controller.authorization : undefined;
                    if (securityName !== undefined) {
                        if (securityTemplates[securityName] === undefined) {
                            throw new Error(`Can't find template ${securityName} in securityTemplate`)
                        }
                        security = securityTemplates[securityName];
                    }
                }

                for (const parameter of method.parameters) {
                    if (parameter.options.paramIn === 'body') {
                        const mediaType = parameter.options.mediaType || method.options.mediaType || controller.options.mediaType || '*/*';
                        requestBody = requestBody || {
                            content: { [mediaType]: {} }
                        };
                        const mediaTypeObj = requestBody.content[mediaType];
                        if (parameter.options.wholeParam) {
                            if (mediaTypeObj.schema) {
                                throw new Error('encountered multiple body parameters');
                            }
                            mediaTypeObj.schema = parameter.schema;
                            if (parameter.required) requestBody.required = true;
                        } else {
                            let bodySchema: oa.SchemaObject = mediaTypeObj.schema;
                            if (!bodySchema) {
                                bodySchema = mediaTypeObj.schema = { type: 'object', properties: {} };
                            }

                            if (bodySchema.properties[parameter.name]) {
                                throw new Error('encountered multiple body parameter ' + parameter.name);
                            }
                            bodySchema.properties[parameter.name] = parameter.schema;
                            if (parameter.required) {
                                requestBody.required = true;
                                if (bodySchema.required === undefined) {
                                    bodySchema.required = [];
                                }
                                bodySchema.required.push(parameter.name);
                            }
                        }
                    } else if (parameter.options.wholeParam) {
                        // TODO: set same parameter schema as reference
                        const schema = parameter.schema.$ref ? this.metadata.typeSchemas.byRef(parameter.schema.$ref) : parameter.schema;
                        if (schema.properties) {
                            for (const name in schema.properties) {
                                if (schema.properties.hasOwnProperty(name)) {
                                    paramObjs.push(this.getParamObject(name, parameter.options.paramIn,
                                        schema.properties[name],
                                        schema.required && schema.required.indexOf(name) != -1)
                                    );
                                }
                            }
                        }
                    } else {
                        paramObjs.push(this.getParamObject(parameter.name, parameter.options.paramIn, parameter.schema, parameter.required));
                    }
                }

                method.routes.forEach(route => {
                    const path = this.buildFullRoute(route.route, controller);
                    let pathObj: oa.PathItemObject = this.rootDoc.paths[path];
                    if (!pathObj) {
                        this.addPath(path, pathObj = {});
                    };

                    const operation: oa.OperationObject = {
                        tags: [ controllerName ],
                        responses: { default: { description: 'Success' } }
                    };
                    if (method.summary) operation.summary = method.summary;
                    if (paramObjs.length) operation.parameters = paramObjs;
                    if (requestBody && route.method !== 'get') operation.requestBody = requestBody;
                    if (method.returnSchema) {
                        (<oa.ResponseObject>operation.responses.default).content = {
                            [method.options.mediaType || controller.options.mediaType || '*/*']: {
                                schema: method.returnSchema
                            }
                        };
                    }
                    if (security) {
                        // openapi3-ts definition is wrong
                        (<any>operation).security = [security];
                    }

                    pathObj[route.method] = operation;
                });
            })
        });

        // add all referenced schemas
        // TODO: filter unused schemas
        const schemas = this.metadata.typeSchemas;
        for (const [name, schema] of schemas) {
            this.addSchema(name, schema);
        }

        return super.getSpec();
    }

    private buildFullRoute(route: string, controller: Controller): string {
        let path: string = "";
        if (controller.route) path += controller.route;
        if (route && typeof route === "string") path += route;

        return path.replace(/(\/)?:(\w+)(\(.*?\))?(\*)?(\?)?/g, '$1{$2}');
    }

    private getParamObject(name: string, where: string, schema: TypeSchema, required?: boolean): oa.ParameterObject {
        const paramObj: oa.ParameterObject = { name, in: where };
        if (required || where === 'path') {
            paramObj.required = true;
        }

        paramObj.schema = {};
        for (const key in schema) {
            if (schema.hasOwnProperty(key)) {
                if (key !== 'description') {
                    paramObj.schema[key] = schema[key];
                } else {
                    paramObj[key] = schema[key];
                }
            }
        }

        return paramObj;
    }
}
