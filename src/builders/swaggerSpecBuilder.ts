
import * as oa from "openapi3-ts";
import { OpenApiBuilder } from "./openApiBuilder";
import { MetadataGenerator } from "../generators/metadataGenerator";
import { Controller } from "../generators/controllerGenerator";
import { Config } from "../types";

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

                    pathObj[route.method] = operation;
                });
            })
        });
        return super.getSpec();
    }

    private buildFullRoute(route: string, controller: Controller): string {
        let path: string = "";
        if (controller.route) path += controller.route;
        if (route && typeof route === "string") path += route;

        return path.replace(/(\/)?:(\w+)(\(.*?\))?(\*)?(\?)?/g, '$1{$2}');
    }
}
