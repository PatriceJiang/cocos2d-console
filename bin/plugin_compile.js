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
exports.CCPluginCOMPILE = void 0;
const cocos_cli_1 = require("./cocos_cli");
const path = require("path");
const os = require("os");
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
        this.parser.add_predefined_argument("cmake_generator");
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
    get_cmake_generator() {
        return this.args.get_string("cmake_generator");
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
                    env: process.env,
                    shell: true
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
    compile_android() {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    compile_ios() {
        return __awaiter(this, void 0, void 0, function* () {
            yield (new IOSCompileCMD(this)).compile();
        });
    }
    compile_mac() {
        return __awaiter(this, void 0, void 0, function* () {
            yield (new MacCompileCMD(this)).compile();
        });
    }
    compile_win32() {
        return __awaiter(this, void 0, void 0, function* () {
            yield (new Win32CompileCMD(this)).compile();
        });
    }
}
exports.CCPluginCOMPILE = CCPluginCOMPILE;
class PlatformCompileCmd {
    constructor(plugin) {
        this.plugin = plugin;
    }
}
class IOSCompileCMD extends PlatformCompileCmd {
    compile() {
        return __awaiter(this, void 0, void 0, function* () {
            let build_dir = this.plugin.get_build_dir();
            let project_src_dir = path.join(this.plugin.project_dir, "frameworks/runtime-src");
            if (!(yield afs_1.afs.exists(path.join(project_src_dir, "CMakelists.txt")))) {
                throw new Error(`CMakeLists.txt not found in ${project_src_dir}`);
            }
            if (!(yield afs_1.afs.exists(build_dir))) {
                cocos_cli_1.CCHelper.mkdir_p_sync(build_dir);
            }
            yield this.plugin.run_cmake(["-S", `${project_src_dir}`, "-GXcode", `-B${build_dir}`, "-DCMAKE_SYSTEM_NAME=iOS", "-DCMAKE_OSX_SYSROOT=iphoneos"]);
            yield this.plugin.run_cmake(["--build", `${build_dir}`, "--config", "Debug"]);
            return true;
        });
    }
}
class MacCompileCMD extends PlatformCompileCmd {
    compile() {
        return __awaiter(this, void 0, void 0, function* () {
            let build_dir = this.plugin.get_build_dir();
            let project_src_dir = path.join(this.plugin.project_dir, "frameworks/runtime-src");
            if (!(yield afs_1.afs.exists(path.join(project_src_dir, "CMakelists.txt")))) {
                throw new Error(`CMakeLists.txt not found in ${project_src_dir}`);
            }
            if (!(yield afs_1.afs.exists(build_dir))) {
                cocos_cli_1.CCHelper.mkdir_p_sync(build_dir);
            }
            yield this.plugin.run_cmake(["-S", `${project_src_dir}`, "-GXcode", `-B${build_dir}`, "-DCMAKE_SYSTEM_NAME=Darwin"]);
            yield this.plugin.run_cmake(["--build", `${build_dir}`, "--config", "Debug"]);
            return true;
        });
    }
}
class Win32CompileCMD extends PlatformCompileCmd {
    get_win32_cmake() {
        return "cmake";
    }
    win32_select_cmake_generator_args() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`selecting visual studio generator ...`);
            const visualstudio_generators = cocos_cfg.cmake.win32.generators;
            let test_proj_dir = yield afs_1.afs.mkdtemp(path.join(os.tmpdir(), "cmake_test_"));
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
            `;
                yield afs_1.afs.writeFile(test_cmake_lists_path, cmake_content);
                yield afs_1.afs.writeFile(test_cpp_file, cpp_src);
            }
            let try_run_cmake_with_arguments = (args, workdir) => {
                return new Promise((resolve, reject) => {
                    let cp = child_process.spawn(this.get_win32_cmake(), args, {
                        cwd: workdir,
                        env: process.env,
                        shell: true
                    });
                    cp.on("close", (code, sig) => {
                        if (code != 0) {
                            resolve(false);
                            return;
                        }
                        resolve(true);
                    });
                });
            };
            let available_generators = [];
            for (let cfg of visualstudio_generators) {
                let build_dir = path.join(test_proj_dir, `build_${cfg.G.replace(/ /g, "_")}`);
                let args = [`-S"${test_proj_dir}"`, `-G"${cfg.G}"`, `-B"${build_dir}"`];
                if ("A" in cfg) {
                    args.push("-A", cfg.A);
                }
                yield afs_1.afs.mkdir(build_dir);
                if (yield try_run_cmake_with_arguments(args, build_dir)) {
                    available_generators.push(cfg.G);
                    break;
                }
                yield cocos_cli_1.CCHelper.rm_r(build_dir);
            }
            yield cocos_cli_1.CCHelper.rm_r(test_proj_dir);
            let ret = [];
            if (available_generators.length == 0) {
                return []; // use cmake default option -G
            }
            let opt = visualstudio_generators.filter(x => x.G == available_generators[0])[0];
            for (let k in opt) {
                ret.push(`-${k}"${opt[k]}"`);
            }
            console.log(` using ${opt.G}`);
            return ret;
        });
    }
    fix_path(p) {
        return path.win32.normalize(p).replace(/\\/g, "\\\\");
    }
    compile() {
        return __awaiter(this, void 0, void 0, function* () {
            let build_dir = this.plugin.get_build_dir();
            let project_src_dir = path.join(this.plugin.project_dir, "frameworks/runtime-src");
            if (!(yield afs_1.afs.exists(path.join(project_src_dir, "CMakelists.txt")))) {
                throw new Error(`CMakeLists.txt not found in ${project_src_dir}`);
            }
            if (!(yield afs_1.afs.exists(build_dir))) {
                cocos_cli_1.CCHelper.mkdir_p_sync(build_dir);
            }
            let g = this.plugin.get_cmake_generator();
            let generate_args = [];
            if (g) {
                let optlist = cocos_cfg.cmake.win32.generators.filter(x => x.G.toLowerCase() == g.toLowerCase());
                if (optlist.length == 0) {
                    generate_args.push(`-G"${g}"`);
                }
                else {
                    let opt = optlist[0];
                    for (let t of opt) {
                        generate_args.push(`-${t}"${opt[t]}"`);
                    }
                }
            }
            else {
                generate_args = generate_args.concat(yield this.win32_select_cmake_generator_args());
            }
            yield this.plugin.run_cmake([`-S"${this.fix_path(project_src_dir)}"`, `-B"${this.fix_path(build_dir)}"`].concat(generate_args));
            yield this.plugin.run_cmake([`-S"${this.fix_path(project_src_dir)}"`, "--build", `${this.fix_path(build_dir)}`, "--config", "Debug"]);
            return true;
        });
    }
}
//# sourceMappingURL=plugin_compile.js.map