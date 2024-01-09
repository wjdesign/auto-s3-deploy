"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = __importDefault(require("child_process"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const package_json_1 = __importDefault(require("../package.json"));
const dirName = __dirname;
const packagePath = path_1.default.join(dirName, "package.json");
const packageTempPath = path_1.default.join(dirName, "package_templete.json");
const cpConfig = { cwd: dirName, stdio: "inherit" };
if (process.argv.length > 2) {
    switch (process.argv[2]) {
        case "--test":
            fs_1.default.copyFileSync(packageTempPath, packagePath);
            child_process_1.default.execSync("node ../bin/cli.js", cpConfig);
            fs_1.default.unlinkSync(packagePath);
            break;
        case "--help":
            fs_1.default.copyFileSync(packageTempPath, packagePath);
            child_process_1.default.execSync("node ../bin/cli.js -h", cpConfig);
            fs_1.default.unlinkSync(packagePath);
            break;
        case "--init":
            fs_1.default.copyFileSync(packageTempPath, packagePath);
            break;
        case "--debug":
            child_process_1.default.execSync("npm run build");
            fs_1.default.copyFileSync(packageTempPath, packagePath);
            break;
        case "--pack":
            child_process_1.default.execSync("npm run build");
            child_process_1.default.execSync("npm run pack");
        case "--clear":
            fs_1.default.unlinkSync(packagePath);
            break;
    }
}
else {
    child_process_1.default.execSync("npm run build");
    fs_1.default.copyFileSync(packageTempPath, packagePath);
    const packName = child_process_1.default.execSync("npm pack ..", { cwd: dirName }).toLocaleString().trim();
    child_process_1.default.execSync(`npm i ${packName}`, cpConfig);
    child_process_1.default.execSync(`npx ${package_json_1.default.name} -h`, cpConfig);
    fs_1.default.unlinkSync(packagePath);
    fs_1.default.unlinkSync(path_1.default.join(dirName, packName));
}
//# sourceMappingURL=index.js.map