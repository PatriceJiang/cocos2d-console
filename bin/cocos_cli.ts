

import * as fs from "fs";
import * as path from "path";
import * as ml from "./multi_language";
import * as cocos_cfg from "./cocos_config.json";

enum ArgumentItemType {
    BOOL_FLAG,
    STRING_VALUE,
    ACTION,
    ENUM,
}

interface ArgumentConfig {
    short:string;
    long:string;
    field?:string;
    help:string;
    arg_type:ArgumentItemType;
    action?:()=>void;
    enum_values?:string[];
    required:boolean;
    default_value?:string;
}
/** pre-defined arguments */
//export const pa:{[key:string]:ArgumentConfig} = {
export const pa = {
    help: {short:"-h", long:"--help", help:"show this message", arg_type:ArgumentItemType.ACTION},
    src_dir:{short:"-s", long:"--src", help: ml.get_string("COCOS_HELP_ARG_SRC"), arg_type: ArgumentItemType.STRING_VALUE},
    quiet:{short:'-q', long:"--quiet", help: ml.get_string("COCOS_HELP_ARG_PLATFORM"), arg_type:ArgumentItemType.BOOL_FLAG},
    platform:{short:"-p", long:"--platform", help: ml.get_string("COCOS_HELP_ARG_PLATFORM"), arg_type:ArgumentItemType.ENUM, enum_values: cocos_cfg.platforms},
    do_list_platforms:{short:"", long:"--list-platforms", help: "list available platforms", arg_type:ArgumentItemType.ACTION},
    proj_dir: {short: "",long: "--proj-dir", help: ml.get_string("COCOS_HELP_ARG_PROJ_DIR"), arg_type: ArgumentItemType.STRING_VALUE},
    package_name:{short: "-p", long: "--package", help:ml.get_string("NEW_ARG_PACKAGE"), arg_type: ArgumentItemType.STRING_VALUE},
    directory:{short:"-d", long:"--directory", help: ml.get_string("NEW_ARG_DIR"), arg_type: ArgumentItemType.STRING_VALUE},
   // template: {short:"-t", long: "--template", help: ml.get_string("NEW_ARG_TEMPLATE"), arg_type: ArgumentItemType.STRING_VALUE},
    ios_bundleid:{short:"", long:"--ios-bundleid", help: ml.get_string("NEW_ARG_IOS_BUNDLEID"), arg_type: ArgumentItemType.STRING_VALUE},
    mac_bundleid: {short:"", long:"--mac-bundleid", help: ml.get_string("NEW_ARG_MAC_BUNDLEID"), arg_type: ArgumentItemType.STRING_VALUE},
    engine_path: {short:"-e", long:"--engine-path", help:ml.get_string("NEW_ARG_ENGINE_PATH"), arg_type: ArgumentItemType.STRING_VALUE},
    portrait: {short:"", long:"--portrait", help:ml.get_string("NEW_ARG_PORTRAIT"), arg_type: ArgumentItemType.BOOL_FLAG},
    no_native: {short:"", long:"--no-native", help:ml.get_string("NEW_ARG_NO_NATIVE"), arg_type:ArgumentItemType.BOOL_FLAG},
    language: {short:"-l", long:"--language", help:ml.get_string("NEW_ARG_LANG"), arg_type:ArgumentItemType.ENUM, enum_values:cocos_cfg.languages},
    do_list_templates: {short:"", long:"--list-templates", help:"List available templates. To be used with --template option.", arg_type: ArgumentItemType.ACTION},
    template_name: {short:"-k", long:"--template-name", help:'Name of the template to be used to create the game. To list available names, use --list-templates.', arg_type:ArgumentItemType.STRING_VALUE},
};


class ArgumentParser {
    private definations:ArgumentConfig[] = [];

    private values:{[key:string]:(string|boolean|{():void})} = {};
    private other_values:string[] = [];

    add_argument(short:string, long:string, field:string, arg_type:ArgumentItemType, help:string, enum_values:string[], required:boolean, action?:()=>void, default_value?:string):ArgumentConfig {
        if(short.length != 0 && (!short.startsWith("-") || short.length != 2)){
            console.error(`short argument ${short} format incorrect!`);
        }
        if(!long.startsWith("--")){
            console.error(`long argument ${long} format incorrect!`);
        }
        let item = {short, long, help, arg_type, field, enum_values, action, required, default_value};
        this.definations.push(item);
        return item;
    }

    add_predefined_argument(field: string, action?:()=>void):ArgumentConfig|undefined {
        let item = (pa as any)[field];
        if(item) {
            return this.add_argument(item.short, item.long, field, item.arg_type, item.help, item.enum_values, false, action);
        }else {
            console.error(`Predefiend argument "${field}" is not found!`)
        }
    }

    add_predefined_argument_with_default(field: string, default_value:string) : ArgumentConfig|undefined {
        let item = (pa as any)[field];
        if(item) {
            return this.add_argument(item.short, item.long, field, item.arg_type, item.help, item.enum_values, false, undefined, default_value);
        }else {
            console.error(`Predefiend argument "${field}" is not found!`)
        }
    }

    add_required_predefined_argument(field: string, action?:()=>void):ArgumentConfig|undefined {
        let item = (pa as any)[field];
        if(item) {
            return this.add_argument(item.short, item.long, field, item.arg_type, item.help, item.enum_values, true, action);
        }else {
            console.error(`Predefiend argument "${field}" is not found!`)
        }
    }

    parse(list:string[]) {

        let cfgs: ArgumentConfig[] = [];
        for(let i=0;i<list.length;i++) {
            let line = list[i];
            cfgs.length = 0;
            let prefix:string;
            if(line.startsWith("--")){
                cfgs = this.definations.filter(x=> line.startsWith(x.long)).sort((a,b)=>a.long.length - b.long.length);
                if(cfgs.length > 0) prefix = cfgs[0].long;
            }else if (line.startsWith("-")){
                cfgs = this.definations.filter(x=> x.short.length > 0 && line == x.short);
                if(cfgs.length > 0) prefix = cfgs[0].short;
            } else {
                this.other_values.push(line);
                continue;
            }


            if(cfgs.length > 0) {
                if(cfgs.length > 1){
                    console.error(`multiple argument match ${line}`);
                    break;
                }
                const cfg = cfgs[0];
                if(cfg.arg_type == ArgumentItemType.BOOL_FLAG) {
                    this.values[cfg.field!] = true;
                    if(line.length > prefix!.length) {
                        console.warn(`argument ${line} too long?`)
                    }
                }else if(cfg.arg_type == ArgumentItemType.STRING_VALUE || cfg.arg_type == ArgumentItemType.ENUM) {

                    if(line.length == prefix!.length){
                        if(list[i+1] == undefined || list[i+1].startsWith("-")){
                            console.warn(`argument "${prefix!}" is not provided with value?`)
                        }
                        this.values[cfg.field!] = list[i+1];
                        i++;
                        continue;
                    }
                    if(line.length > prefix!.length) {
                        let value = line.substr(prefix!.length);
                        this.values[cfg.field!] = value[0]==="=" ? value.substr(1) : value;
                        continue;
                    }
                }else if(cfg.arg_type == ArgumentItemType.ACTION){
                    this.values[cfg.field!] = cfg.action!;
                }
            }else {
                console.error(`unknown argument: ${line}`)
            }
        }
    }

    private defination_for(key:string):ArgumentConfig|null {
        let list = this.definations.filter(x=> x.field == key);
        if(list.length > 1) {
            console.warn(`multiply command line argument definations for "${key}"`);
        }else if(list.length == 0) {
            console.error(`no command line argument defination for "${key}" found!`);
            return null;
        }
        return list[0];
    }

    public get_bool(key:string):boolean {
        return (this.values[key] as boolean) === true;
    }
    
    public get_path(key:string):string {
        return (key in this.values) ? this.values[key] as string: this.defination_for(key)!.default_value!;
    }
    
    public get_string(key:string):string {
        return this.get_path(key);
    }

    public exist_key(key:string):boolean {
        return key in this.values;
    }

    public call(key:string):void {
       if(typeof this.values[key] === "function") {
           (this.values[key] as any).apply();
       }else {
           console.error(`argument value of ${key} is not a function`)
       }
    }

    public call_all():boolean {
        for(let key in this.values) {
            let f = this.values[key];
            if(typeof(f) === "function") {
                (f as any).call(); 
                return true;
            }
        }
        return false;
    }

    public get_otherargs():string[] {
        return this.other_values;
    }

    public print() {
        console.log("Usage:")
        for(let i of this.definations) {
            console.log(` ${i.short.length == 0 ? "" : i.short+", "}${i.long} \t: ${i.help}`);
        }
    }

    public validate() {
        for(let key in this.values) {
            // validate enums
            let v = this.values[key];
            let defs = this.definations.filter(x=>x.field == key);
            if(defs.length > 0 ){
                if(defs[0].arg_type == ArgumentItemType.ENUM) {
                    if(!defs[0].enum_values!.includes(v as string)){
                        console.error(` incorrect argument "${defs[0].long} ${v}", expect "${defs[0].enum_values!.join(",")}"`);
                    }
                }
            }
        }

        for(let d of this.definations) {
            if(d.required && !(d.field! in this.values)) {
                console.error(` required argument ${d.long} is not provided!`);
            }
        }
    }
}


export abstract class CCPlugin {
    private _cocos2d_path:string|null = null;
    private _template_path:string|null = null;
    private _plugin_name:string|null = null;
    
    parser: ArgumentParser = new ArgumentParser();

    get_cocos_root():string|null {

        let engine_path = this.get_engine_path();
        if(!!engine_path) {
            return engine_path;
        }

        if(!this._cocos2d_path) {
            this._cocos2d_path = path.join(__dirname, "../../..");
            if(!fs.existsSync(path.join(this._cocos2d_path, "cocos"))){
                console.warn(ml.get_string("COCOS_WARNING_ENGINE_NOT_FOUND"));
                this._cocos2d_path = null;
            }
        }
        return this._cocos2d_path;
    }

    get_consle_root():string {
        let engine_path = this.get_engine_path();
        if(!!engine_path) {
            return path.join(engine_path, "tools/cocos2d-console");
        }

        return path.join(__dirname, "..");
    }

    get_template_root_path():string|null {

        let engine_path = this.get_engine_path();
        if(!!engine_path) {
            return path.join(engine_path, "templates");
        }


        if(!this._template_path){
            let cocos2d_path = this.get_cocos_root();
            if(cocos2d_path) {
                this._template_path = path.join(cocos2d_path, "templates");
            }else{
                this._template_path = null;
            }
        }
        return this._template_path;
    }

    private do_list_platforms(){
        console.log("support platforms:");
        for(let p of cocos_cfg.platforms) {
            console.log(` - ${p}`);
        }
    }

    private do_show_help() {
        let parser = this.parser;
        parser.print();
    }

    parse_args() {

        let parser = this.parser;

        parser.add_predefined_argument("src_dir");
        parser.add_predefined_argument("quiet");
        parser.add_predefined_argument("platform");
        parser.add_predefined_argument("do_list_platforms", this.do_list_platforms.bind(this));
        parser.add_predefined_argument("proj_dir");
        parser.add_predefined_argument("help", this.do_show_help.bind(this));

        this.define_args();
        let args = process.argv.slice(3);
        this.parser.parse(args);
    }

    abstract define_args():void;

    abstract init():boolean;

    abstract async run():Promise<boolean>;

    get_engine_path():string|null {
        return null;
    }

    ///////////////// helper methods

    get_templates_dir_names():string[] {
        let template_dir = this.get_template_root_path();
        if(template_dir) {
            return fs.readdirSync(template_dir).filter(x=>!x.startsWith("."));
        }
        return [];
    }

    get_template_dir_paths():string[] {
        let template_dir = this.get_template_root_path();
        return this.get_templates_dir_names().map(x=> path.join(template_dir!, x));
    }

    exec() {
        this.parse_args();
        if(this.parser.call_all()) return;
        this.parser.validate();
        this.init();
        this.run();
    }

    get args(): ArgumentParser {
        return this.parser;
    }
}

export class CCHelper {

    private static replace_env_variables(str:string):string {
        return str.replace(/\$\{([^\}]*)\}/g, (_, n)=> process.env[n]!).
            replace(/(\~)/g, (_, n)=> process.env["HOME"]!);
    }

    static copy_file_sync(src_root:string, src_file:string, dst_root:string, dst_file:string) {
        src_root = this.replace_env_variables(src_root);
        src_file = this.replace_env_variables(src_file);
        dst_root = this.replace_env_variables(dst_root);
        dst_file = this.replace_env_variables(dst_file);
        this.mkdir_p_sync(dst_root);
        this.mkdir_p_sync(path.join(dst_root, dst_file, ".."));
        let src = path.join(src_root, src_file);
        let dst = path.join(dst_root, dst_file);
        fs.copyFileSync(src, dst);
    }

    static copy_file_async(src:string, dst:string) {
        this.mkdir_p_sync(path.parse(dst).dir);
        return new Promise<boolean>((resolve, reject)=>{
            fs.copyFile(src, dst, (err)=>{
                if(err) return reject(err);
                resolve(true);
            })
        });
    }

    static copy_recursive_async(src_dir:string, dst:string) {
        src_dir = this.replace_env_variables(src_dir);
        dst = this.replace_env_variables(dst);
        return new Promise((resolve, reject)=>{
            let tasks: Promise<any>[] = [];
            fs.stat(src_dir, (err, stat)=>{
                if(!stat) {
                    console.error(`failed to stat ${src_dir}`);
                    return resolve();
                }
                if(err) reject(err);
                if(stat.isDirectory()) {
                    this.mkdir_p_sync(dst);
                    fs.readdir(src_dir, (err, files)=>{
                        if(err) return reject(err);
                        for(let f of files) {
                            if(f == "." || f == "..") continue;
                            let fp = path.join(src_dir, f);
                            let tsk =this.copy_recursive_async(fp, path.join(dst, f));
                            tasks.push(tsk);
                        }
                        Promise.all(tasks).then(resolve, reject);
                    });
                } else if(stat.isFile()) {
                    this.copy_file_async(src_dir, dst).then(resolve, reject);
                }
            })
            
        });
    }

    static par_copy_files(par:number, src_root:string, files:string[], dst_dir:string) {
        let running_tasks  = 0;
        //console.log(`par copy files ${par} ${src_root} to ${dst_dir}`)
        return new Promise((resolve, reject)=>{
            let copy_async = (src:string, dst:string) => {
                //console.log(`cp ${src} -> ${dst}`);
                let dst_dir = path.parse(dst).dir;
                running_tasks += 1;
                this.copy_recursive_async(src, dst).then(()=>{
                    running_tasks -= 1;
                    schedule_copy();
                }).catch((err)=>reject(err));
            };
            let schedule_copy = ()=>{
                if(files.length > 0 && running_tasks < par) {
                    let f = files.shift()!;
                    copy_async(path.join(src_root,f), path.join(dst_dir,f))
                }
                if(files.length == 0 && running_tasks == 0) {
                    resolve();
                }
            }
            for(let i = 0 ; i< par; i++) schedule_copy();
        });
    }

    static mkdir_p_sync(dir:string) {
        if(dir.length == 0) return;
        let dirs:string[] =[];
        let p = dir;
        while(!fs.existsSync(p)){
            dirs.push(p);
            p = path.join(p, "..");
        }
        while(dirs.length > 0) {
            fs.mkdirSync(dirs[dirs.length - 1]);
            dirs.length = dirs.length - 1;
        }
    }

    static copy_files_with_config(cfg:{from:string, to:string, include?:string[], exclude?:string[]}, src_root:string, dst_root:string) {
        
        if(!fs.existsSync(src_root)){
            console.error(`copy file src_root ${src_root} is not exists!`);
            return;
        }
        src_root = this.replace_env_variables(src_root);
        dst_root = this.replace_env_variables(dst_root);
        let from = this.replace_env_variables(cfg.from)
        let to = this.replace_env_variables(cfg.to);
        if(path.isAbsolute(from)) {
            src_root = from;
            from = ".";
        }
        if(path.isAbsolute(to)) {
            dst_root = to;
            to = ".";
        }

        let build_prefix_tree = (list0:string[]) => {
            let tree:any = {};
            let list = list0.map(x=>Array.from(x));
            while(list.length > 0) {
                let t = list.shift()!;
                let p = tree;
                while(t.length > 0) {
                    let c = t.shift()!;
                    if(c in p) {
                        p = p[c];
                        continue;
                    } else {
                        p[c] = {};
                    }
                }
            }
            return tree;
        };

        let match_prefix_tree = (str:string, tree:any) :boolean => {
            if(tree == null){
                return false;
            }
            let arr = Array.from(str);
            let i = 0;
            let p = tree;
            while(arr[i] in p) {
                p = p[arr[i]];
                i++;
            }
            return i == arr.length && Object.keys(p).length == 0;
        }

        let include_prefix = cfg.include ? build_prefix_tree(cfg.include) : null;
        let exclude_prefix = cfg.exclude ? build_prefix_tree(cfg.exclude) : null;

 

        let cp_r_async = (src_root:string, src_dir:string, dst_root:string) => {
            let fullpath = path.join(src_root, src_dir);
            return new Promise((resolve, reject)=>{
                fs.stat(fullpath, (err, stat)=>{
                    if(err) {
                        return reject(err);
                    }
                    if(stat.isDirectory()) {
                        fs.readdir(fullpath, (err, files)=>{
                            if(err) {
                                reject(err);
                                return;
                            }
                            for(let f of files) {
                                if(f == "."  || f == "..") continue;
                                let cf = path.join(src_dir, f);
                                if(exclude_prefix && match_prefix_tree(cf, exclude_prefix)) {
                                    if(include_prefix && match_prefix_tree(cf, include_prefix)) {
                                        //include
                                    }else {
                                        continue;
                                    }
                                }
                                cp_r_async(src_root, path.join(src_dir, f), dst_root);
                            } 
                            resolve();
                        });
                    } else if (stat.isFile()) {
                        this.copy_file_async(fullpath, path.join(dst_root, src_dir))
                            .then(resolve, reject);
                    }
                });

            })
        }

        return new Promise((resolve, reject)=>{
            let copy_from = path.normalize(path.join(src_root, from));
            let copy_to = path.normalize(path.join(dst_root, to));
            let stat = fs.statSync(copy_from);
            if(stat.isFile()) {
                this.copy_file_async(copy_from, copy_to).then(resolve, reject);
            }else{
                cp_r_async(src_root, from, copy_to).then(resolve, reject)
            }
        });
    }

    static replace_in_file( patterns: {reg:string, text:string}[], filepath:string) {
        if(!fs.existsSync(filepath)) {
            console.warn(`file ${filepath} not exists while replacing content!`);
            return;
        }
        console.log(`replace ${filepath} with ${JSON.stringify(patterns)}`);
        let lines = fs.readFileSync(filepath).toString("utf8").split("\n");

        let new_content = lines.map(l => {
            patterns.forEach(p => {
                l = l.replace(new RegExp(p.reg), p.text);
            });
            return l;
        }).join("\n");

        fs.writeFileSync(filepath,  new_content);
    }
}




class CCPluginRunner {
    public run() {
        let plugin_name = process.argv[2]
        let p:CCPlugin |null = null;
        let script_path = path.join(__dirname, `plugin_${plugin_name}.js`);
        if(!fs.existsSync(script_path)) {
            console.error(`Plugin ${plugin_name} is not defined!`);
            return;
        }

        let exp = require(script_path);
        let klsName = `CCPlugin${plugin_name.toUpperCase()}`;
        if(klsName in exp) {
            p = new exp[klsName];
        }else{
            console.error(`${klsName} not defined in plugin_${plugin_name}.js`);
            return;
        }
        if(p) {
            p.exec();
        }
    }
}

process.on("unhandledRejection", (err, promise)=>{
    console.error(err);
});

let runner = new CCPluginRunner();

runner.run();