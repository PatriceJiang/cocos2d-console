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
const cocos_cli_1 = require("./cocos_cli");
const path = require("path");
const cocos_cfg = require("./cocos_config.json");
const child_process = require("child_process");
const afs_1 = require("./afs");
const PackageNewConfig = "cocos-project-template.json";
class CCPluginCOMPILE extends cocos_cli_1.CCPlugin {
    constructor() {
        super(...arguments);
        this._platform = null;
    }
    define_args() {
        this.parser.add_required_predefined_argument("build_dir");
        this.parser.add_required_predefined_argument("directory");
    }
    init() {
        this._platform = this.get_platform();
        if (cocos_cfg.platforms.indexOf(this._platform) < 0) {
            console.error(`invalidate platform "${this._platform}"`);
        }
        return true;
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.compile_platform(this._platform);
            return true;
        });
    }
    compile_platform(p) {
        return __awaiter(this, void 0, void 0, function* () {
            if (p === "mac") {
                yield this.compile_mac();
            }
            else if (p == "ios") {
                yield this.compile_ios();
            }
            else if (p == "win32") {
                yield this.compile_win32();
            }
            else if (p == "android") {
                yield this.compile_android();
            }
        });
    }
    get_build_dir() {
        let dir = this.args.get_string("build_dir");
        return cocos_cli_1.CCHelper.replace_env_variables(path.join(dir, `build-${this._platform}`));
    }
    get project_dir() {
        let dir = this.args.get_path("directory");
        return cocos_cli_1.CCHelper.replace_env_variables(dir);
    }
    run_cmake(args) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                let cp = child_process.spawn("/usr/local/bin/cmake", args, {
                    stdio: ["pipe", "pipe", "pipe"],
                    env: process.env
                });
                cp.stdout.on("data", (data) => {
                    console.log(`[cmake] ${data}`);
                });
                cp.stderr.on("data", (data) => {
                    console.log(`[cmake-err] ${data}`);
                });
                cp.on("close", (code, sig) => {
                    if (code !== 0) {
                        reject(new Error(`run cmake failed "cmake ${args.join(" ")}", code: ${code}, signal: ${sig}`));
                        return;
                    }
                    resolve();
                });
            });
        });
    }
    compile_mac() {
        return __awaiter(this, void 0, void 0, function* () {
            let build_dir = this.get_build_dir();
            let project_src_dir = path.join(this.project_dir, "frameworks/runtime-src");
            if (!(yield afs_1.afs.exists(path.join(project_src_dir, "CMakelists.txt")))) {
                throw new Error(`CMakeLists.txt not found in ${project_src_dir}`);
            }
            if (!(yield afs_1.afs.exists(build_dir))) {
                cocos_cli_1.CCHelper.mkdir_p_sync(build_dir);
            }
            yield this.run_cmake(["-S", `${project_src_dir}`, "-GXcode", `-B${build_dir}`, "-DCMAKE_SYSTEM_NAME=Darwin"]);
            yield this.run_cmake(["--build", `${build_dir}`, "--config", "Debug"]);
        });
    }
    win32_select_cmake() {
        return __awaiter(this, void 0, void 0, function* () {
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
        `;
            const vs_list = cocos_cfg.cmake.win32.generators;
            let proj_dir = yield afs_1.afs.mkdtemp("cmake_test");
            let cmake_lists = path.join(proj_dir, "CMakeLists.txt");
            let cpp_file = path.join(proj_dir, "test.cpp");
            yield afs_1.afs.writeFile(cmake_lists, cmake_content);
            yield afs_1.afs.writeFile(cpp_file, cpp_src);
            let run_success = (flags, dir) => {
                return new Promise((resolve, reject) => {
                    let cp = child_process.spawn("cmake", flags, {
                        cwd: dir,
                        env: process.env
                    });
                    cp.stderr.on("data", (data) => {
                        console.log(`[test-cmake error] ${data}`);
                    });
                    cp.on("close", (code, sig) => {
                        if (code != 0) {
                            console.error(`failed to run "cmake ${flags.join(" ")}"`);
                            resolve(false);
                            return;
                        }
                        resolve(true);
                    });
                });
            };
            let available_generators = [];
            for (let cfg of vs_list) {
                let args = ["..", "-G", `"${cfg.G}"`];
                if ("A" in cfg) {
                    args.push("-A", cfg.A);
                }
                let build_dir = path.join(proj_dir, `build_${cfg.G.replace(/ /g, "_")}`);
                yield afs_1.afs.mkdir(build_dir);
                if (yield run_success(args, build_dir)) {
                    available_generators.push(cfg.G);
                }
                else {
                    yield cocos_cli_1.CCHelper.rm_r(build_dir);
                }
            }
            console.log(`generators "${available_generators}" in ${proj_dir}`);
        });
    }
    compile_win32() {
        return __awaiter(this, void 0, void 0, function* () {
            let build_dir = this.get_build_dir();
            let project_src_dir = path.join(this.project_dir, "frameworks/runtime-src");
            if (!(yield afs_1.afs.exists(path.join(project_src_dir, "CMakelists.txt")))) {
                throw new Error(`CMakeLists.txt not found in ${project_src_dir}`);
            }
            if (!(yield afs_1.afs.exists(build_dir))) {
                cocos_cli_1.CCHelper.mkdir_p_sync(build_dir);
            }
            yield this.win32_select_cmake();
            // await this.run_cmake(["-S", `${project_src_dir}`, "-GXcode", `-B${build_dir}`, "-DCMAKE_SYSTEM_NAME=Windows"])
            // await this.run_cmake(["--build",`${build_dir}`, "--config", "Debug"]);
        });
    }
    compile_ios() {
        return __awaiter(this, void 0, void 0, function* () {
            let build_dir = this.get_build_dir();
            let project_src_dir = path.join(this.project_dir, "frameworks/runtime-src");
            if (!(yield afs_1.afs.exists(path.join(project_src_dir, "CMakelists.txt")))) {
                throw new Error(`CMakeLists.txt not found in ${project_src_dir}`);
            }
            if (!(yield afs_1.afs.exists(build_dir))) {
                cocos_cli_1.CCHelper.mkdir_p_sync(build_dir);
            }
            yield this.run_cmake(["-S", `${project_src_dir}`, "-GXcode", `-B${build_dir}`, "-DCMAKE_SYSTEM_NAME=iOS", "-DCMAKE_OSX_SYSROOT=iphoneos"]);
            yield this.run_cmake(["--build", `${build_dir}`, "--config", "Debug"]);
        });
    }
    compile_android() {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
}
exports.CCPluginCOMPILE = CCPluginCOMPILE;
//# sourceMappingURL=plugin_compile.js.map