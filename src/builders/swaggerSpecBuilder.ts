
import * as oa from "openapi3-ts";
import { OpenApiBuilder } from "./openApiBuilder";
import { MetadataGenerator } from "../generators/metadataGenerator";
import { Controller } from "../generators/controllerGenerator";
import { Config } from "../config";

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
            let tag = controller.name.replace(/controller$/i, '');
            controller.methods.forEach(method => {
                method.routes.forEach(route => {
                    let path = this.buildFullRoute(route.route, controller);
                    let pathObj: oa.PathItemObject = this.rootDoc.paths[path];
                    if (!pathObj) {
                        this.addPath(path, pathObj = {});
                    };

                    pathObj[route.method] = <oa.OperationObject>{
                        tags: [ tag ],
                        responses: { default: { description: 'Success' } }
                    };
                });
            })
        });
        return super.getSpec();
    }

    private buildFullRoute(route: string, controller: Controller): string {
        let path: string = "";
        if (controller.route) path += controller.route;
        if (route && typeof route === "string") path += route;
        return path;
    }
}
