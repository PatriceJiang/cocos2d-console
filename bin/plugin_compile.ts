
import {CCPlugin, pa, CCHelper} from "./cocos_cli";

import * as path from "path";
import * as fs  from "fs";
import * as cocos_cfg from "./cocos_config.json";
import * as cocos_project from "./cocos_project_types";
import * as cocos2dx_files from "../../../templates/cocos2dx_files.json";
import * as child_process from "child_process";
import {afs} from "./afs";
import { resolve } from "dns";
import { rejects } from "assert";

const PackageNewConfig = "cocos-project-template.json";

export class CCPluginCOMPILE extends CCPlugin {

    _platform:string|null = null;

    define_args(): void {
        this.parser.add_required_predefined_argument("build_dir");
        this.parser.add_required_predefined_argument("directory");
    }
    init(): boolean {
        this._platform = this.get_platform();
        if(cocos_cfg.platforms.indexOf(this._platform) < 0) {
            console.error(`invalidate platform "${this._platform}"`);
        }
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

    async win32_select_cmake() {
        let cmake_content = `
        cmake_minimum_required(VERSION 3.8)
        set(APP_NAME test-cmake)
        project(\${APP_NAME} CXX)
        add_library(\${APP_NAME} test.cpp)
        `;
        let cpp_src = `
        #include<iostream>
        int main(int argc, char **argv)
        {
            std::cout << "Hello World" << std::endl;
            return 0;
        }
        `
        const vs_list = cocos_cfg.cmake.win32.generators;

        let proj_dir = await afs.mkdtemp("cmake_test");
        let cmake_lists = path.join(proj_dir, "CMakeLists.txt");
        let cpp_file = path.join(proj_dir, "test.cpp");
        await afs.writeFile(cmake_lists, cmake_content);
        await afs.writeFile(cpp_file, cpp_src);

        let run_success=(flags:string[], dir:string) => {
            return new Promise<boolean>((resolve, reject)=>{
                let cp = child_process.spawn("cmake", flags, {
                    cwd: dir,
                    env: process.env
                });
                cp.stderr.on("data", (data)=>{
                    console.log(`[test-cmake error] ${data}`);
                });
                cp.on("close", (code, sig)=>{
                    if(code!=0){
                        console.error(`failed to run "cmake ${flags.join(" ")}"`)
                        resolve(false);
                        return;
                    }
                    resolve(true);
                });
            });
        }
        let available_generators :string[]= [];
        for(let cfg of vs_list) {
            let args:string[] = ["..", "-G", `"${cfg.G}"`];
            if("A" in cfg){
                args.push("-A", cfg.A!)
            }
            let build_dir = path.join(proj_dir, `build_${cfg.G.replace(/ /g, "_")}`);
            await afs.mkdir(build_dir);
            if(await run_success(args, build_dir)){
                available_generators.push(cfg.G);
            }else{
                await CCHelper.rm_r(build_dir);
            }
        }
        console.log(`generators "${available_generators}" in ${proj_dir}`)
    }


    async compile_win32() {
        let build_dir = this.get_build_dir();
        let project_src_dir = path.join(this.project_dir!, "frameworks/runtime-src");

        if(!(await afs.exists(path.join(project_src_dir, "CMakelists.txt")))){
            throw new Error(`CMakeLists.txt not found in ${project_src_dir}`);
        }

        if(!(await afs.exists(build_dir))) {
            CCHelper.mkdir_p_sync(build_dir);
        }

        await this.win32_select_cmake();

        // await this.run_cmake(["-S", `${project_src_dir}`, "-GXcode", `-B${build_dir}`, "-DCMAKE_SYSTEM_NAME=Windows"])
        // await this.run_cmake(["--build",`${build_dir}`, "--config", "Debug"]);
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