import cp, { ExecSyncOptions } from 'child_process'
import fs from 'fs'
import path from 'path'
import packageCfg from '../package.json'

const dirName = __dirname
const packagePath = path.join(dirName, "package.json")
const packageTempPath = path.join(dirName, "package_templete.json")
const cpConfig: ExecSyncOptions = { cwd: dirName, stdio: "inherit" }

if (process.argv.length > 2) {
    switch (process.argv[2]) {
        case "--test":
            fs.copyFileSync(packageTempPath, packagePath)
            cp.execSync("node ../bin/cli.js", cpConfig)
            fs.unlinkSync(packagePath)
            break;
        case "--help":
            fs.copyFileSync(packageTempPath, packagePath)
            cp.execSync("node ../bin/cli.js -h", cpConfig)
            fs.unlinkSync(packagePath)
            break;
        case "--init":
            fs.copyFileSync(packageTempPath, packagePath)
            break;
        case "--debug":
            cp.execSync("npm run build")
            fs.copyFileSync(packageTempPath, packagePath)
            break;
        case "--pack":
            cp.execSync("npm run build")
            cp.execSync("npm run pack")
        case "--clear":
            fs.unlinkSync(packagePath)
            break;
    }
} else {
    cp.execSync("npm run build")
    fs.copyFileSync(packageTempPath, packagePath)
    const packName = cp.execSync("npm pack ..", { cwd: dirName }).toLocaleString().trim()
    cp.execSync(`npm i ${packName}`, cpConfig)
    cp.execSync(`npx ${packageCfg.name} -h`, cpConfig)
    fs.unlinkSync(packagePath)
    fs.unlinkSync(path.join(dirName, packName))
}




