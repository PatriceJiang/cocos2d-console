import { CCPlugin, pa, cchelper } from "./cocos_cli";

import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as cocos_cfg from "./cocos_config.json";
import * as cocos_project from "./cocos_project_types";
import * as cocos2dx_files from "../../../templates/cocos2dx_files.json";
import * as child_process from "child_process";
import { afs } from "./afs";

const PackageNewConfig = "cocos-project-template.json";

export class CCPluginRUN extends CCPlugin {

    depends():string | null {
        return "compile";
    }

    define_args(): void {
        this.parser.add_required_predefined_argument("build_dir");
    }
    init(): boolean {
        return true;
    }
    async run(): Promise<boolean> {
        let platform: string = this.get_platform();
        let build_dir: string = this.get_build_dir();
        let project_name: string | undefined = this.get_project_name_from_cmake();
        if (platform == "mac") {
            this.mac_run(project_name);
        }
        return true;
    }

    private get_project_name_from_cmake(): string | undefined {
        let cmake_cache = path.join(this.get_build_dir(), "CMakeCache.txt");
        if (!fs.existsSync(cmake_cache)) {
            console.error(`can not find "CMakeCache.txt" in ${this.get_build_dir()}, please run "cmake -G" first`);
        }
        let project_name = cchelper.exact_value_from_file(/CMAKE_PROJECT_NAME:\w+=(\w+)/, cmake_cache, 1);
        return project_name;
    }

    private mac_run(project_name?: string) {

        let debug_dir = path.join(this.get_build_dir(), "Debug");
        if (!fs.existsSync(debug_dir)) {
            console.log(`${debug_dir} is not exist!`);
            process.exit(1);
        }
        let app_path: string;
        if (project_name) {
            app_path = path.join(debug_dir, `${project_name}-desktop.app`);
            if (fs.existsSync(app_path)) {
                this.mac_open(app_path);
                return;
            }
        }

        let app_list = fs.readdirSync(debug_dir).filter(x => x.endsWith(".app"));
        if (app_list.length == 1) {
            return this.mac_open(path.join(debug_dir, app_list[0]));
        }
        console.error(`found ${app_list.length} apps, failed to open.`);
        process.exit(1);
    }

    private mac_open(app: string) {
        console.log(`open ${app}`);
        let cp = child_process.spawn(`open`, [app], {
            shell: true,
            env: process.env
        });
        cp.stdout.on("data", (data) => {
            console.log(`[open app] ${data}`);
        });
        cp.stderr.on(`data`, (data) => {
            console.error(`[open app error] ${data}`);
        });
        cp.on("close", (code, sig) => {
            console.log(`${app} exit with ${code}, sig: ${sig}`);
        });
    }

}