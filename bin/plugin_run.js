"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CCPluginRUN = void 0;
const cocos_cli_1 = require("./cocos_cli");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const PackageNewConfig = "cocos-project-template.json";
class CCPluginRUN extends cocos_cli_1.CCPlugin {
    define_args() {
        this.parser.add_required_predefined_argument("build_dir");
    }
    init() {
        return true;
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            let platform = this.get_platform();
            let build_dir = this.get_build_dir();
            let project_name = this.get_project_name_from_cmake();
            if (platform == "mac") {
                this.mac_run(project_name);
            }
            return true;
        });
    }
    get_project_name_from_cmake() {
        let cmake_cache = path.join(this.get_build_dir(), "CMakeCache.txt");
        if (!fs.existsSync(cmake_cache)) {
            console.error(`can not find "CMakeCache.txt" in ${this.get_build_dir()}, please run "cmake -G" first`);
        }
        let project_name = cocos_cli_1.CCHelper.exact_value_from_file(/CMAKE_PROJECT_NAME:\w+=(\w+)/, cmake_cache, 1);
        return project_name;
    }
    mac_run(project_name) {
        let debug_dir = path.join(this.get_build_dir(), "Debug");
        if (!fs.existsSync(debug_dir)) {
            console.log(`${debug_dir} is not exist!`);
            process.exit(1);
        }
        let app_path;
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
    mac_open(app) {
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
exports.CCPluginRUN = CCPluginRUN;
//# sourceMappingURL=plugin_run.js.map