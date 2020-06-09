
import {CCPlugin, pa, CCHelper} from "./cocos_cli";

import * as path from "path";
import * as fs  from "fs";
import * as os from "os";
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
        this.parser.add_predefined_argument("cmake_generator");
        this.parser.add_predefined_argument("cmake_path");
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
        let c = this.get_current_platform();

        let allow_targets = (cocos_cfg.availableTargetPlatforms as any)[c];
        if(!!!allow_targets) {
            console.error(`current host platform ${c} is not supported.`);
            process.exit(1);
            return;
        }

        if(allow_targets.indexOf(p) < 0) {
            console.error(`target platform "${p}" is not listed [${allow_targets.join(", ")}]`);
            process.exit(1);
            return;
        }

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

    get_cmake_generator():string|undefined {
        return this.args.get_string("cmake_generator");
    }

    get_build_dir():string {
        let dir = this.args.get_string("build_dir");
        return CCHelper.replace_env_variables(path.join(dir, `build-${this._platform}`));
    }

    get_cmake_path(): string {
        let cp = this.args.get_string("cmake_path");
        return !!cp ? cp : "cmake";
    }

    get project_dir():string | undefined {
        let dir = this.args.get_path("directory");
        return CCHelper.replace_env_variables(dir);
    }

    async run_cmake(args:string[]) {
        return new Promise((resolve, reject)=>{
            let cp = child_process.spawn(this.get_cmake_path(), args, {
                stdio:["pipe","pipe","pipe"],
                env: process.env,
                shell: true
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


    async compile_android() {

    }

    async compile_ios() {
        await (new IOSCompileCMD(this)).compile();
    }

    async compile_mac() {
        await (new MacCompileCMD(this)).compile();
    }

    async compile_win32() {
        await (new Win32CompileCMD(this)).compile();
    }

}

abstract class PlatformCompileCmd {
    plugin: CCPluginCOMPILE;
    constructor(plugin:CCPluginCOMPILE){
        this.plugin = plugin;
    }
    abstract async compile(): Promise<boolean>;
}

class IOSCompileCMD extends PlatformCompileCmd {
    async compile() {
        let build_dir = this.plugin.get_build_dir();
        let project_src_dir = path.join(this.plugin.project_dir!, "frameworks/runtime-src");

        if(!(await afs.exists(path.join(project_src_dir, "CMakelists.txt")))){
            throw new Error(`CMakeLists.txt not found in ${project_src_dir}`);
        }

        if(!(await afs.exists(build_dir))) {
            CCHelper.mkdir_p_sync(build_dir);
        }

        await this.plugin.run_cmake(["-S", `${project_src_dir}`, "-GXcode", `-B${build_dir}`, "-DCMAKE_SYSTEM_NAME=iOS", "-DCMAKE_OSX_SYSROOT=iphoneos"])
        await this.plugin.run_cmake(["--build",`${build_dir}`, "--config", "Debug"]);
        return true;
    }
}

class MacCompileCMD extends PlatformCompileCmd {
    async compile() {
        let build_dir = this.plugin.get_build_dir();
        let project_src_dir = path.join(this.plugin.project_dir!, "frameworks/runtime-src");

        if(!(await afs.exists(path.join(project_src_dir, "CMakelists.txt")))){
            throw new Error(`CMakeLists.txt not found in ${project_src_dir}`);
        }

        if(!(await afs.exists(build_dir))) {
            CCHelper.mkdir_p_sync(build_dir);
        }

        await this.plugin.run_cmake(["-S", `${project_src_dir}`, "-GXcode", `-B${build_dir}`, "-DCMAKE_SYSTEM_NAME=Darwin"])
        await this.plugin.run_cmake(["--build",`${build_dir}`, "--config", "Debug"]);
        return true;
    }
}


class Win32CompileCMD extends PlatformCompileCmd {

    async win32_select_cmake_generator_args(): Promise<string[]> {

        console.log(`selecting visual studio generator ...`);
        const visualstudio_generators = cocos_cfg.cmake.win32.generators;
        
        let test_proj_dir = await afs.mkdtemp(path.join(os.tmpdir(),"cmake_test_"));
        let test_cmake_lists_path = path.join(test_proj_dir, "CMakeLists.txt");
        let test_cpp_file = path.join(test_proj_dir, "test.cpp");
        {
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
            await afs.writeFile(test_cmake_lists_path, cmake_content);
            await afs.writeFile(test_cpp_file, cpp_src);
        }

        let try_run_cmake_with_arguments=(args:string[], workdir:string) => {
            return new Promise<boolean>((resolve, reject)=>{
                let cp = child_process.spawn(this.plugin.get_cmake_path(), args, {
                    cwd: workdir,
                    env: process.env,
                    shell:true
                });
                cp.on("close", (code, sig)=>{
                    if(code!=0){
                        resolve(false);
                        return;
                    }
                    resolve(true);
                });
            });
        }
        let available_generators :string[]= [];
        for(let cfg of visualstudio_generators) {
            let build_dir = path.join(test_proj_dir, `build_${cfg.G.replace(/ /g, "_")}`);
            let args:string[] = [`-S"${test_proj_dir}"`, `-G"${cfg.G}"`, `-B"${build_dir}"`];
            if("A" in cfg){
                args.push("-A", cfg.A!)
            }
            await afs.mkdir(build_dir);
            if(await try_run_cmake_with_arguments(args, build_dir)){
                available_generators.push(cfg.G);
                break;
            }
            await CCHelper.rm_r(build_dir);
        }
        await CCHelper.rm_r(test_proj_dir);

        let ret:string[] = [];
        if(available_generators.length == 0) {
            return []; // use cmake default option -G
        } 
        let opt = visualstudio_generators.filter(x=>x.G == available_generators[0])[0];
        for(let k in opt){
            ret.push(`-${k}"${(opt as any)[k]}"`);
        }
        console.log(` using ${opt.G}`)
        return ret;
    }


    fix_path(p:string):string {
        return path.win32.normalize(p).replace(/\\/g, "\\\\");
    }

    async compile() {
        let build_dir = this.plugin.get_build_dir();
        let project_src_dir = path.join(this.plugin.project_dir!, "frameworks/runtime-src");

        if(!(await afs.exists(path.join(project_src_dir, "CMakelists.txt")))){
            throw new Error(`CMakeLists.txt not found in ${project_src_dir}`);
        }

        if(!(await afs.exists(build_dir))) {
            CCHelper.mkdir_p_sync(build_dir);
        }

        let g = this.plugin.get_cmake_generator();
        let generate_args :string[] = [];
        if(g) {
            let optlist = cocos_cfg.cmake.win32.generators.filter(x=>x.G.toLowerCase() == g!.toLowerCase());
            if(optlist.length == 0) {
                generate_args.push(`-G"${g}"`);
            }else{
                let opt = optlist[0] as any;
                for(let t of opt) {
                    generate_args.push(`-${t}"${opt[t]}"`);
                }
            }
        }else{
            generate_args = generate_args.concat(await this.win32_select_cmake_generator_args());
        }
        await this.plugin.run_cmake([`-S"${this.fix_path(project_src_dir)}"`, `-B"${this.fix_path(build_dir)}"`].concat(generate_args));
        await this.plugin.run_cmake([`-S"${this.fix_path(project_src_dir)}"`,"--build",`${this.fix_path(build_dir)}`, "--config", "Debug"]);
        return true;
    }
}