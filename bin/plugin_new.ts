
import {CCPlugin, pa, CCHelper} from "./cocos_cli";

import * as path from "path";
import * as fs  from "fs";
import * as cocos_cfg from "./cocos_config.json";
import * as cocos_project from "./cocos_project_types";
import * as cocos2dx_files from "../../../templates/cocos2dx_files.json";

const PackageNewConfig = "cocos-project-template.json";

export class CCPluginNEW extends CCPlugin {

    define_args(): void {
        let parser = this.parser;
        parser.add_predefined_argument_with_default("package_name", "CocosGame");
        parser.add_required_predefined_argument("directory");
        //parser.add_required_predefined_argument("template")
        parser.add_predefined_argument_with_default("ios_bundleid", "org.cocos2dx.ios");
        parser.add_predefined_argument_with_default("mac_bundleid", "org.cocos2dx.mac");
        parser.add_predefined_argument("engine_path");
        parser.add_predefined_argument("portrait");
        parser.add_predefined_argument("no_native");
        parser.add_required_predefined_argument("language");
        parser.add_predefined_argument("do_list_templates", this.do_list_templates.bind(this));
        parser.add_predefined_argument_with_default("template_name", "js-template-link");
    }
    init(): boolean {
        
        this.set_env("PROJECT_NAME", this.project_name!);

        let parser = this.parser;
        // console.log(`PROJECT_NAME name ${this.project_name}`);
        let cocos_dir = this.get_cocos_root();
        if(!fs.existsSync(path.join(cocos_dir!, "cocos/cocos2d.h"))) {
            console.error(`cocos2d.h not found in ${cocos_dir}, path incorrect!`);
            return false;
        }

        return true;
    }
    async run(): Promise<boolean> {
        let lang = this.args.get_path("language");
        let package_name = this.args.get_string("package_name");
        let mac_bundleid = this.args.get_string("mac_bundleid");
        let ios_bundleid = this.args.get_string("ios_bundleid");
        let template_dir = path.join(this.get_template_root_path()!, this.template_name);
        let tp = new TemplateCreator(lang, this.get_cocos_root()!, this.project_name!, this.project_dir!, 
            this.template_name!, template_dir ,package_name, mac_bundleid, ios_bundleid);

        await tp.run(); // async
        return true;    
    }
    /* override */
    get_engine_path():string|null {
        return this.args.get_path("engine_path");
    }

    private do_list_templates() {
        console.log(`templates:`)
        let dirs = this.get_templates_dir_names();
        for(let d of dirs) {
            console.log(` - ${d}/`);
        }
    }

    get project_name():string |undefined {
        if(this.args.get_otherargs().length == 0) {
            console.error(`argument project name is not set!`);
        }
        return this.args.get_otherargs()[0];
    }

    get project_dir():string | undefined {
        let dir = this.args.get_path("directory");
        return dir;
    }

    get engine_path() :string{
        return this.args.get_path("engine_path");
    }

    get template_name() : string {
        let tpn = this.args.get_path("template_name");
        if(this.get_templates_dir_names().filter(x=>x.startsWith(tpn)).length == 0) {
            console.error(`can not find template ${tpn}`);
        }
        return tpn;
    }
    
    get selected_template_path():string|null {
        if(!this.template_name) return null;
        let dir = path.join(this.get_template_root_path()!, this.template_name);
        if(!fs.existsSync(dir)) {
            console.error(`selected template path not exists: ${dir}`);
        }
        let st = fs.statSync(dir);
        if(!st.isDirectory()){
            console.error(`selected template path is not directory: ${dir}`);
        }

        let check_files:string[] = ["main.js","project.json", PackageNewConfig , "frameworks"];
        for(let f of check_files) {
            if(!fs.existsSync(path.join(dir, f))) {
                console.warn(`file "${f}" does not exists in ${dir}, template path can be incorrect setting!`);
            }
        }
        return dir;
    }
}



export class TemplateCreator {
    lang ?: string;
    cocos_root ?: string;
    project_name ?: string;
    project_dir ?: string;
    tp_name ?:string;
    tp_dir ?:string;
    package_name ?:string;
    mac_bundleid?:string;
    ios_bundleid?:string;

    template_info?:cocos_project.CocosProjecConfig;

    excludes:string[] = [];

    constructor(lang:string, cocos_root:string, project_name:string, project_dir:string, tp_name:string, tp_dir:string, project_package:string, mac_id:string, ios_id:string) {
        this.lang = lang;
        this.cocos_root = cocos_root;
        this.project_name = project_name;
        this.project_dir = project_dir;
        this.package_name = project_package;
        this.mac_bundleid = mac_id;
        this.ios_bundleid = ios_id;
        this.tp_name = tp_name;
        this.tp_dir = tp_dir;

        if(!fs.existsSync(path.join(tp_dir, PackageNewConfig))) {
            console.error(`can not find ${PackageNewConfig} in ${tp_dir}`);
            return;
        }

        this.template_info = JSON.parse(fs.readFileSync(path.join(tp_dir, PackageNewConfig)).toString("utf8"));
        if(!("do_default" in this.template_info!)) {
            console.error(`can not find "do_default" in ${PackageNewConfig}`);
            return;
        }
    }

    async run() {
        let default_cmds = this.template_info!.do_default;
        if(default_cmds){
            await CCHelper.copy_files_with_config(
                {
                    from: this.tp_dir!,
                    to: this.project_dir!,
                    exclude: default_cmds.exclude_from_template
                }, this.tp_dir!, this.project_dir!);
            await this.execute(default_cmds);
            delete this.template_info!.do_default;
        }

        for(let key in this.template_info!){
            // console.log(`other commands ${key}`)
            await this.execute((this.template_info as any)[key] as any);
        }
    }

    private async execute(cmds: cocos_project.CocosProjectTasks) {
        if(cmds.append_file) {
            cmds.append_file.forEach(cmd=> {
                CCHelper.copy_file_sync(this.cocos_root!, cmd.from, this.project_dir!, cmd.to);
            });
            delete cmds.append_file;
        }

        if(cmds.exclude_from_template) {
            // do nothing
            delete cmds.exclude_from_template;
        }

        if(cmds.append_x_engine) {
            let common = cocos2dx_files.common;    
            let to = path.join(this.project_dir!, cmds.append_x_engine.to);
            await CCHelper.par_copy_files(20, this.cocos_root!, common, to);
            if(this.lang == "js") {
                let fileList = cocos2dx_files.js;
                await CCHelper.par_copy_files(20, this.cocos_root!, fileList, to);
            }
            delete cmds.append_x_engine;
        }

        if(cmds.append_from_template) {
            let cmd = cmds.append_from_template;

            // console.log(`append-from-template ${JSON.stringify(cmd)}`);
            await CCHelper.copy_files_with_config({
                from: cmd.from, 
                to: cmd.to,
                exclude: cmd.exclude
            }, this.tp_dir!, this.project_dir!);

            delete cmds.append_from_template;
        }

        let replace_files_delay: {[key:string]:{ reg: string, content:string}[]} = {};
        if(cmds.project_replace_project_name) {
            let cmd = cmds.project_replace_project_name;

            cmd.files.forEach(file => {
                let fp = path.join(this.project_dir!, file);
                replace_files_delay[fp] = replace_files_delay[fp] || [];
                replace_files_delay[fp].push({
                    reg: cmd.src_project_name,
                    content: this.project_name!
                });
            });
            delete cmds.project_replace_project_name;
        }

        if(cmds.project_replace_package_name) {
            let cmd = cmds.project_replace_package_name;
            let name = cmd.src_package_name.replace(/\./g, "\\.");
            cmd.files.forEach(file => {
                let fp = path.join(this.project_dir!, file);
                replace_files_delay[fp] = replace_files_delay[fp] || [];
                replace_files_delay[fp].push({
                    reg: name,
                    content: this.package_name!
                });
            });
            delete cmds.project_replace_package_name;
        }

        if(cmds.project_replace_mac_bundleid) {
            let cmd = cmds.project_replace_mac_bundleid;
            let bundle_id = cmd.src_bundle_id.replace(/\./g, "\\.");
            cmd.files.forEach(file => {
                let fp = path.join(this.project_dir!, file);
                replace_files_delay[fp] = replace_files_delay[fp] || [];
                replace_files_delay[fp].push({
                    reg: bundle_id,
                    content: this.mac_bundleid!
                });
            });
            delete cmds.project_replace_mac_bundleid;
        }

        if(cmds.project_replace_ios_bundleid) {
            let cmd = cmds.project_replace_ios_bundleid;
            let bundle_id = cmd.src_bundle_id.replace(/\./g, "\\.");
            cmd.files.forEach(file => {
                let fp = path.join(this.project_dir!, file);
                replace_files_delay[fp] = replace_files_delay[fp] || [];
                replace_files_delay[fp].push({
                    reg: bundle_id,
                    content: this.ios_bundleid!
                });
            });
            delete cmds.project_replace_ios_bundleid;
        }

        if(cmds.common_replace) {
            for(let cmd of cmds.common_replace) {
                for(let f of cmd.files) {
                    let fp = path.join(this.project_dir!, f);
                    replace_files_delay[fp] = replace_files_delay[fp] || [];
                    replace_files_delay[fp].push({
                        reg: cmd.pattern,
                        content: cmd.value
                    });
                }
            }
            delete cmds.common_replace;
        }

        for(let fullpath in replace_files_delay) {
            let cfg = replace_files_delay[fullpath];
            CCHelper.replace_in_file(cfg.map(x=>{
                return {reg: x.reg, text: x.content};
            }), fullpath);
        }

        if(Object.keys(cmds).length > 0) {
            for(let f in cmds) {
                console.error(`command "${f}" is not parsed in ${PackageNewConfig}`);
            }
        }
    }

}