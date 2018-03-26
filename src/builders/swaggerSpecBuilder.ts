
import * as oa from "openapi3-ts";
import { OpenApiBuilder } from "./openApiBuilder";
import { Config } from "../types";
import { MetadataGenerator } from "../generators/metadataGenerator";
import { Controller } from "../generators/controllerGenerator";
import { TypeSchema } from "../generators/typeGenerator";

export class SwaggerSpecBuilder extends OpenApiBuilder {
    constructor(private readonly metadata: MetadataGenerator, private readonly config: Config) {
        super();
    }

    public getSpec(): oa.OpenAPIObject {
        const { info, servers } = this.config;
        this.addTitle(info.title).addVersion(info.version);
        if (info.description) this.addDescription(info.description);
        if (servers && servers.length) {
            servers.forEach(s => this.addServer(s));
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

                for (const parameter of method.parameters) {
                    if (parameter.where === 'body') {
                        requestBody = requestBody || {
                            content: {
                                [controller.mediaType || '*/*']: {
                                }
                            }
                        };
                        const mediaType = requestBody.content[controller.mediaType || '*/*'];
                        if (parameter.wholeParam) {
                            if (mediaType.schema) {
                                throw new Error('encountered multiple body parameters');
                            }
                            mediaType.schema = parameter.schema;
                            if (parameter.required) requestBody.required = true;
                        } else {
                            let bodySchema: oa.SchemaObject = mediaType.schema;
                            if (!bodySchema) {
                                bodySchema = mediaType.schema = { type: 'object', properties: {} };
                            }

                            if (bodySchema.properties[parameter.name]) {
                                throw new Error('encountered multiple body parameter ' + parameter.name);
                            }
                            bodySchema.properties[parameter.name] = parameter.schema;
                            if (parameter.required) {
                                requestBody.required = true;
                                // openapi3-ts didn't define such field
                                if ((<TypeSchema>bodySchema).required === undefined) {
                                    (<TypeSchema>bodySchema).required = [];
                                }
                                (<TypeSchema>bodySchema).required.push(parameter.name);
                            }
                        }
                    } else if (parameter.wholeParam) {
                        // TODO: set same parameter schema as reference
                        const schema = parameter.schema.$ref ? this.metadata.typeSchemas.byRef(parameter.schema.$ref) : parameter.schema;
                        if (schema.type === 'object') {
                            for (const name in schema.properties) {
                                if (schema.properties.hasOwnProperty(name)) {
                                    paramObjs.push(this.getParamObject(name, parameter.where,
                                        schema.properties[name],
                                        schema.required && schema.required.indexOf(name) != -1)
                                    );
                                }
                            }
                        }
                    } else {
                        paramObjs.push(this.getParamObject(parameter.name, parameter.where, parameter.schema, parameter.required));
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
                    if (method.returnSchema && (method.returnSchema.type || method.returnSchema.$ref)) {
                        (<oa.ResponseObject>operation.responses.default).content = {
                            [controller.mediaType || '*/*']: {
                                schema: method.returnSchema
                            }
                        };
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
