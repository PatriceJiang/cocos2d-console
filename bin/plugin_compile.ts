
import {CCPlugin, pa, CCHelper} from "./cocos_cli";

import * as path from "path";
import * as fs  from "fs";
import * as cocos_cfg from "./cocos_config.json";
import * as cocos_project from "./cocos_project_types";
import * as cocos2dx_files from "../../../templates/cocos2dx_files.json";
import * as child_process from "child_process";
import {afs} from "./afs";

const PackageNewConfig = "cocos-project-template.json";

export class CCPluginCOMPILE extends CCPlugin {

    _platform:string|null = null;

    define_args(): void {
        this.parser.add_required_predefined_argument("build_dir");
        this.parser.add_required_predefined_argument("directory");
    }
    init(): boolean {
        this._platform = this.get_platform();
        return true;
    }

    async run(): Promise<boolean> {
        await this.compile_platform(this._platform!);
        return true;
    }

    async compile_platform(p:string) {
        if(p === "mac") {
           await this.compile_mac();
        } else if(p == "ios") {
            await this.compile_ios();
        } else if(p == "win32") {
            await this.compile_win32();
        } else if(p == "android") {
            await this.compile_android();
        }
    }

    private get_build_dir():string {
        let dir = this.args.get_string("build_dir");
        return CCHelper.replace_env_variables(path.join(dir, `build-${this._platform}`));
    }

    get project_dir():string | undefined {
        let dir = this.args.get_path("directory");
        return CCHelper.replace_env_variables(dir);
    }

    async run_cmake(args:string[]) {
        return new Promise((resolve, reject)=>{
            let cp = child_process.spawn("/usr/local/bin/cmake", args, {
                stdio:["pipe","pipe","pipe"],
                env: process.env
            });
            cp.stdout.on("data",(data)=>{
                console.log(`[cmake] ${data}`);
            });
            cp.stderr.on("data",(data)=>{
                console.log(`[cmake-err] ${data}`);
            });
            cp.on("close", (code, sig)=>{
                if(code !== 0) {
                    reject(new Error(`run cmake failed "cmake ${args.join(" ")}", code: ${code}, signal: ${sig}`));
                    return;
                }
                resolve();
            });
        });
    }

    async compile_mac() {
        let build_dir = this.get_build_dir();
        let project_src_dir = path.join(this.project_dir!, "frameworks/runtime-src");

        if(!(await afs.exists(path.join(project_src_dir, "CMakelists.txt")))){
            throw new Error(`CMakeLists.txt not found in ${project_src_dir}`);
        }

        if(!(await afs.exists(build_dir))) {
            CCHelper.mkdir_p_sync(build_dir);
        }

        await this.run_cmake(["-S", `${project_src_dir}`, "-GXcode", `-B${build_dir}`, "-DCMAKE_SYSTEM_NAME=Darwin"])
        await this.run_cmake(["--build",`${build_dir}`, "--config", "Debug"]);
    }

    async compile_win32() {

    }

    async compile_ios() {
        let build_dir = this.get_build_dir();
        let project_src_dir = path.join(this.project_dir!, "frameworks/runtime-src");

        if(!(await afs.exists(path.join(project_src_dir, "CMakelists.txt")))){
            throw new Error(`CMakeLists.txt not found in ${project_src_dir}`);
        }

        if(!(await afs.exists(build_dir))) {
            CCHelper.mkdir_p_sync(build_dir);
        }

        await this.run_cmake(["-S", `${project_src_dir}`, "-GXcode", `-B${build_dir}`, "-DCMAKE_SYSTEM_NAME=iOS", "-DCMAKE_OSX_SYSROOT=iphoneos"])
        await this.run_cmake(["--build",`${build_dir}`, "--config", "Debug"]);
    }
    async compile_android() {

    }

}