
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
                for (const parameter of method.parameters) {
                    if (parameter.wholeParam && parameter.schema.type === 'object') {
                        for (const name in parameter.schema.properties) {
                            if (parameter.schema.properties.hasOwnProperty(name)) {
                                paramObjs.push(this.getParamObject(name, parameter.where,
                                    parameter.schema.properties[name],
                                    parameter.schema.required && parameter.schema.required.indexOf(name) != -1)
                                );
                            }
                        }
                    } else {
                        paramObjs.push(this.getParamObject(parameter.name, parameter.where, parameter.schema));
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

                    pathObj[route.method] = operation;
                });
            })
        });

        const schemas = this.metadata.typeSchemas;
        for (const name in schemas) {
            if (schemas.hasOwnProperty(name)) {
                const schema: oa.SchemaObject = schemas[name];
                this.addSchema(name, schema);
            }
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
        if (where === 'path' || required) {
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
