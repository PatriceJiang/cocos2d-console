"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.afs = void 0;
const fs = require("fs");
const util_1 = require("util");
exports.afs = {
    readFile: util_1.promisify(fs.readFile),
    readdir: util_1.promisify(fs.readdir),
    stat: util_1.promisify(fs.stat),
    exists: util_1.promisify(fs.exists),
    copyFile: util_1.promisify(fs.copyFile),
    writeFile: util_1.promisify(fs.writeFile),
    mkdir: util_1.promisify(fs.mkdir)
};
//# sourceMappingURL=afs.js.map