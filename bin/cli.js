#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const cli_1 = __importDefault(require("cli"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const mime_types_1 = __importDefault(require("mime-types"));
const md5_file_1 = __importDefault(require("md5-file"));
const inquirer_1 = __importDefault(require("inquirer"));
const package_json_1 = __importDefault(require("../package.json"));
const prettier_1 = __importDefault(require("prettier"));
const promise_1 = __importDefault(require("simple-git/promise"));
cli_1.default.app = package_json_1.default.name;
cli_1.default.version = package_json_1.default.version;
const options = cli_1.default.parse({
    key: [
        'k', 'AWS key', 'string'
    ],
    secret: [
        'c', 'AWS secret', 'string'
    ],
    region: [
        'r', 'S3 region', 'string'
    ],
    bucket: [
        'b', 'S3 bucket', 'string'
    ],
    deployTo: [
        't', 'Bucket path', 'string', ''
    ],
    source: [
        's', 'Source path', 'string', ''
    ],
    distId: [
        'd', 'CloudFront distributionId', 'string'
    ],
    invalidPaths: [
        'i', 'CloudFront invalidation paths', 'string', ['*']
    ],
    cfg: [
        'C', 'Use config in deploy.json', 'string'
    ],
    save: [
        'S', 'Save current config to deploy.json', 'bool'
    ]
});
// eslint-disable-next-line @typescript-eslint/ban-types
function overrideObj(src, target) {
    for (const key in src) {
        const srcEle = src[key];
        const tarEle = target[key];
        if (typeof (srcEle) === 'object') {
            if (tarEle !== undefined && typeof (tarEle) == 'object') {
                overrideObj(srcEle, tarEle);
            }
            else {
                target[key] = srcEle;
            }
        }
        else {
            target[key] = srcEle;
        }
    }
}
main();
async function main() {
    let deployName;
    let deployRootCfg = { configs: {} };
    const deployRootCfgPath = path_1.default.join(process.cwd(), 'deploy.json');
    try {
        deployRootCfg = require(deployRootCfgPath);
    }
    catch (e) {
    }
    if (options.save) {
        const defName = createCfgName(deployRootCfg);
        const newCfg = getDeployCfgByOpt(options);
        deployName = (await inquirer_1.default.prompt({
            type: 'input',
            message: 'please input config name',
            default: defName,
            name: 'result',
            validate: (input) => {
                if (deployRootCfg.configs[input])
                    return 'name duplicate!';
                return true;
            }
        })).result;
        const setDefault = (await inquirer_1.default.prompt({
            type: 'confirm',
            message: 'set default?',
            default: false,
            name: 'result'
        })).result;
        deployRootCfg.configs[deployName] = newCfg;
        if (setDefault)
            deployRootCfg.default = deployName;
        cli_1.default.info(`write config "${deployName}" to deploy.json\n`);
        console.log(newCfg);
        const cfgStr = prettier_1.default.format(JSON.stringify(deployRootCfg), { parser: 'json' });
        fs_1.default.writeFileSync(deployRootCfgPath, cfgStr, { encoding: 'utf8' });
    }
    const git = promise_1.default();
    const coverCfgPath = path_1.default.join(process.cwd(), 'cover-deploy.json');
    let coverCfg;
    try {
        coverCfg = require(coverCfgPath);
    }
    catch (e) {
    }
    if (coverCfg) {
        overrideObj(coverCfg, deployRootCfg);
        if (await git.checkIsRepo() && (await git.checkIgnore(coverCfgPath)).length === 0) {
            cli_1.default.error('please add "cover-deploy.json" to .gitignore');
        }
    }
    if (options.cfg) {
        deployRootCfg.default = options.cfg;
    }
    if (deployRootCfg.default) {
        if (!(deployRootCfg.configs[deployRootCfg.default])) {
            cli_1.default.error(`default config "${deployRootCfg.default}" not exist`);
            cli_1.default.exit(1);
            return;
        }
        deployCfgToOpt(deployRootCfg.configs[deployRootCfg.default], options);
    }
    else {
        const deployNames = ['<current>'];
        for (deployName in deployRootCfg.configs) {
            deployNames.push(deployName);
        }
        deployName = (await inquirer_1.default.prompt({
            type: 'list', message: 'select deploy config ...', choices: deployNames, name: 'result'
        })).result;
        if (deployName !== deployNames[0])
            deployCfgToOpt(deployRootCfg.configs[deployName], options);
    }
    start();
}
async function start() {
    formatOpt2nd(options);
    let exitCode = 0;
    let invalidProp = [];
    const canRun = verifyValid(options, [
        'key',
        'secret',
        'region',
        'bucket'
    ], invalidProp);
    for (let i = 0; i < invalidProp.length; i++) {
        cli_1.default.error(`"${invalidProp[i]}" not set value.`);
    }
    if (canRun) {
        const awsCfg = new aws_sdk_1.default.Config({
            accessKeyId: options.key, secretAccessKey: options.secret, region: options.region
        });
        aws_sdk_1.default.config = awsCfg;
        const s3 = new aws_sdk_1.default.S3();
        try {
            const relativeStart = options.deployTo.replace(/\\/g, '/')
                // 字尾如果是空白的，就加上 '/'
                .replace(/(?<=.)\/?$/, '/');
            const objects = [];
            // 發送第一次切出目錄請求
            let response = await s3.listObjectsV2({ Bucket: options.bucket, Prefix: relativeStart }).promise();
            objects.push(...response.Contents);
            // 如果列出的項目超出 1000 個，則會被截斷，如果被截斷，則在發出繼續列出的請求
            while (response.IsTruncated) {
                response = await s3.listObjectsV2({
                    Bucket: options.bucket, Prefix: relativeStart, ContinuationToken: response.NextContinuationToken
                }).promise();
                objects.push(...response.Contents);
            }
            const localFilePaths = {};
            let localFileCount = getFileRelativePathList(options.source, localFilePaths, relativeStart);
            let i = 0;
            for (i = 0; i < objects.length; i++) {
                const obj = objects[i];
                if (localFilePaths[obj.Key]) {
                    const localFileMd5 = md5_file_1.default.sync(localFilePaths[obj.Key]);
                    // eslint-disable-next-line no-useless-escape
                    if (localFileMd5 === obj.ETag.replace(/\"/g, '')) {
                        delete localFilePaths[obj.Key];
                        localFileCount--;
                    }
                }
            }
            cli_1.default.info(`upload ${localFileCount} file ...`);
            i = 0;
            for (const buckPath in localFilePaths) {
                const fileStream = fs_1.default.createReadStream(localFilePaths[buckPath]);
                const mimeType = mime_types_1.default.lookup(buckPath);
                const upload = s3.upload({
                    Bucket: options.bucket, Key: buckPath, Body: fileStream, ACL: 'public-read', ContentType: mimeType !== false ? mimeType : ''
                });
                upload.on('httpUploadProgress', (progress) => {
                    cli_1.default.progress((i + (progress.loaded / progress.total)) / localFileCount);
                });
                await upload.promise();
                i++;
            }
            const invalidationQuery = options.invalids;
            if (invalidationQuery.length > 0) {
                cli_1.default.info('start create invalidation ...');
                const cf = new aws_sdk_1.default.CloudFront();
                try {
                    for (const invalid of invalidationQuery) {
                        const { distId, invalidPaths } = invalid;
                        invalidProp = [];
                        verifyValid(invalid, [
                            'distId',
                            'invalidPaths'
                        ], invalidProp);
                        if (invalidProp.length === 1 && invalidProp[0] === 'invalidPaths') {
                            cli_1.default.error(`id ${distId} "invalidPaths" not set value.`);
                            continue;
                        }
                        formatInvalidPaths(invalidPaths);
                        await cf.createInvalidation({ DistributionId: distId, InvalidationBatch: { Paths: { Items: invalidPaths, Quantity: invalidPaths.length }, CallerReference: getTimestamp().toString() } }).promise();
                    }
                }
                catch (e) {
                    cli_1.default.error(e);
                    exitCode = 1;
                }
            }
        }
        catch (e) {
            cli_1.default.error(e);
            exitCode = 1;
        }
    }
    cli_1.default.exit(exitCode);
}
function deployCfgToOpt({ aws, s3, cloudFront }, opt) {
    if (aws.key)
        opt.key = aws.key;
    if (aws.secret)
        opt.secret = aws.secret;
    if (s3.region)
        opt.region = s3.region;
    if (s3.bucket)
        opt.bucket = s3.bucket;
    if (s3.to)
        opt.deployTo = s3.to;
    if (s3.source)
        opt.source = s3.source;
    if (cloudFront) {
        opt.invalids = cloudFront instanceof Array ?
            cloudFront.map((v) => ({ distId: v.distributionId, invalidPaths: v.invalidation.paths })) :
            [{ distId: cloudFront.distributionId, invalidPaths: cloudFront.invalidation.paths }];
    }
}
function getDeployCfgByOpt(opt) {
    const cfg = {
        aws: {
            key: opt.key,
            secret: opt.secret
        },
        s3: {
            region: opt.region,
            bucket: opt.bucket,
            source: opt.source,
            to: opt.deployTo
        }
    };
    if (opt.distId) {
        cfg.cloudFront = {
            distributionId: opt.distId,
            invalidation: { paths: opt.invalidPaths }
        };
    }
    return cfg;
}
function getTimestamp() {
    const dateTime = Date.now();
    return Math.floor(dateTime / 1000);
}
function formatOpt2nd(opt) {
    if (typeof (opt.invalidPaths) == 'string') {
        opt.invalidPaths = JSON.parse(opt.invalidPaths);
    }
}
function formatInvalidPaths(paths) {
    for (let i = 0; i < paths.length; i++) {
        const path = paths[i];
        if (path.charAt(0) !== '/')
            paths[i] = '/' + path;
    }
}
function verifyValid(target, propNames, outInvalidOut = null) {
    let result = true;
    for (let i = 0; i < propNames.length; i++) {
        const propName = propNames[i];
        if (target[propName]) {
            if (target[propName] == null || target[propName] === undefined) {
                result = false;
                if (outInvalidOut != null)
                    outInvalidOut.push(propName);
            }
        }
        else {
            result = false;
            if (outInvalidOut != null)
                outInvalidOut.push(propName);
        }
    }
    return result;
}
function getFileRelativePathList(dirPath, outList, relativeStart = '') {
    !dirPath && (dirPath = '.');
    if (!fs_1.default.existsSync(dirPath) || !fs_1.default.lstatSync(dirPath).isDirectory)
        return 0;
    let count = 0;
    const list = fs_1.default.readdirSync(dirPath);
    for (let i = 0; i < list.length; i++) {
        const name = list[i];
        const aPath = path_1.default.join(dirPath, name);
        const rPath = relativeStart.length > 0 ? path_1.default.join(relativeStart, name) : name;
        const entry = fs_1.default.lstatSync(aPath);
        if (entry.isDirectory()) {
            count += getFileRelativePathList(aPath, outList, rPath);
        }
        else {
            outList[rPath.replace(/\\/g, '/')] = aPath;
            count++;
        }
    }
    return count;
}
function createCfgName(rootCfg) {
    let i = 1;
    if (rootCfg) {
        while (true) {
            const name = `deploy${i}`;
            if (!(rootCfg[name]))
                return name;
            i++;
        }
    }
    return `deploy${i}`;
}
//# sourceMappingURL=cli.js.map