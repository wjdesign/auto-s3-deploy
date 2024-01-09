#!/usr/bin/env node

import aws from 'aws-sdk'
import cli from 'cli'
import fs from 'fs'
import path from 'path'
import mime from 'mime-types'
import md5File from 'md5-file'
import inquirer from 'inquirer'
import pkg from '../package.json'
import prettier from 'prettier'
import simpleGit from 'simple-git/promise'

type CloudFront = {
    distributionId: string,
    invalidation: {
        paths: string[]
    }
}

type DeployCfg = {
    aws: {
        key: string,
        secret: string
    },
    s3: {
        region: string,
        bucket: string,
        source: string,
        to: string,
    },
    cloudFront?: CloudFront | CloudFront[]
}

type RootCfg = {
    default?: string
    configs: {
        [key: string]: DeployCfg
    }
}

type PathDict = { [path: string]: string /* fullPath */ }

type BucketObj = {
    Key: string,
    LastModified: Date,
    ETag: string,
    Size: number,
    StorageClass: string,
    Owner: unknown
}
cli.app = pkg.name
cli.version = pkg.version

const options = cli.parse( {
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
        'i', 'CloudFront invalidation paths', 'string', [ '*' ]
    ],
    cfg: [
        'C', 'Use config in deploy.json', 'string'
    ],
    save: [
        'S', 'Save current config to deploy.json', 'bool'
    ]
} )

// eslint-disable-next-line @typescript-eslint/ban-types
function overrideObj ( src: object, target: object ): void {

    for ( const key in src ) {

        const srcEle = src[ key ]
        const tarEle = target[ key ]
        if ( typeof ( srcEle ) === 'object' ) {

            if ( tarEle !== undefined && typeof ( tarEle ) == 'object' ) {

                overrideObj( srcEle, tarEle )

            } else {

                target[ key ] = srcEle

            }

        } else {

            target[ key ] = srcEle

        }

    }

}

main()

async function main () {

    let deployName: string
    let deployRootCfg: RootCfg = { configs: {} }
    const deployRootCfgPath: string = path.join( process.cwd(), 'deploy.json' )

    try {

        deployRootCfg = require( deployRootCfgPath )

    } catch ( e ) {
    }

    if ( options.save ) {

        const defName = createCfgName( deployRootCfg )
        const newCfg = getDeployCfgByOpt( options )
        deployName = ( await inquirer.prompt( {
            type: 'input',
            message: 'please input config name',
            default: defName,
            name: 'result',
            validate: ( input: string ) => {

                if ( deployRootCfg.configs[ input ] ) return 'name duplicate!'
                return true

            }
        } ) ).result

        const setDefault: boolean = ( await inquirer.prompt( {
            type: 'confirm',
            message: 'set default?',
            default: false,
            name: 'result'
        } ) ).result

        deployRootCfg.configs[ deployName ] = newCfg
        if ( setDefault ) deployRootCfg.default = deployName

        cli.info( `write config "${deployName}" to deploy.json\n` )
        console.log( newCfg )

        const cfgStr: string = prettier.format( JSON.stringify( deployRootCfg ), { parser: 'json' } )
        fs.writeFileSync( deployRootCfgPath, cfgStr, { encoding: 'utf8' } )

    }

    const git = simpleGit()
    const coverCfgPath = path.join( process.cwd(), 'cover-deploy.json' )
    let coverCfg: RootCfg | undefined

    try {

        coverCfg = require( coverCfgPath )

    } catch ( e ) {
    }

    if ( coverCfg ) {

        overrideObj( coverCfg, deployRootCfg )

        if ( await git.checkIsRepo() && ( await git.checkIgnore( coverCfgPath ) ).length === 0 ) {

            cli.error( 'please add "cover-deploy.json" to .gitignore' )

        }

    }

    if ( options.cfg ) {

        deployRootCfg.default = options.cfg

    }

    if ( deployRootCfg.default ) {

        if ( !( deployRootCfg.configs[ deployRootCfg.default ] ) ) {

            cli.error( `default config "${deployRootCfg.default}" not exist` )
            cli.exit( 1 )
            return

        }

        deployCfgToOpt( deployRootCfg.configs[ deployRootCfg.default ], options )

    } else {

        const deployNames: string[] = [ '<current>' ]

        for ( deployName in deployRootCfg.configs ) {

            deployNames.push( deployName )

        }

        deployName = ( await inquirer.prompt( {
            type: 'list', message: 'select deploy config ...', choices: deployNames, name: 'result'
        } ) ).result

        if ( deployName !== deployNames[ 0 ] ) deployCfgToOpt( deployRootCfg.configs[ deployName ], options )

    }

    start()

}

async function start () {

    formatOpt2nd( options )

    let exitCode = 0
    let invalidProp: string[] = []
    const canRun = verifyValid( options,
        [
            'key',
            'secret',
            'region',
            'bucket'
        ],
        invalidProp
    )

    for ( let i = 0; i < invalidProp.length; i++ ) {

        cli.error( `"${invalidProp[ i ]}" not set value.` )

    }

    if ( canRun ) {

        const awsCfg: aws.Config = new aws.Config( {
            accessKeyId: options.key, secretAccessKey: options.secret, region: options.region
        } )

        aws.config = awsCfg

        const s3: aws.S3 = new aws.S3()

        try {

            const relativeStart: string = options.deployTo.replace( /\\/g, '/' )
            // 字尾如果是空白的，就加上 '/'
                .replace( /(?<=.)\/?$/, '/' )

            const objects: BucketObj[] = []

            // 發送第一次切出目錄請求
            let response = await s3.listObjectsV2( { Bucket: options.bucket, Prefix: relativeStart } ).promise()
            objects.push( ...response.Contents as BucketObj[] )

            // 如果列出的項目超出 1000 個，則會被截斷，如果被截斷，則在發出繼續列出的請求
            while ( response.IsTruncated ) {

                response = await s3.listObjectsV2( {
                    Bucket: options.bucket, Prefix: relativeStart, ContinuationToken: response.NextContinuationToken
                } ).promise()
                objects.push( ...response.Contents as BucketObj[] )

            }
            const localFilePaths: PathDict = {}

            let localFileCount = getFileRelativePathList( options.source, localFilePaths, relativeStart )
            let i = 0

            for ( i = 0; i < objects.length; i++ ) {

                const obj = objects[ i ]
                if ( localFilePaths[ obj.Key ] ) {

                    const localFileMd5 = md5File.sync( localFilePaths[ obj.Key ] )
                    // eslint-disable-next-line no-useless-escape
                    if ( localFileMd5 === obj.ETag.replace( /\"/g, '' ) ) {

                        delete localFilePaths[ obj.Key ]
                        localFileCount--

                    }

                }

            }

            cli.info( `upload ${localFileCount} file ...` )

            i = 0
            for ( const buckPath in localFilePaths ) {

                const fileStream = fs.createReadStream( localFilePaths[ buckPath ] )
                const mimeType = mime.lookup( buckPath )
                const upload: aws.S3.ManagedUpload = s3.upload( {
                    Bucket: options.bucket, Key: buckPath, Body: fileStream, ACL: 'public-read', ContentType: mimeType !== false ? mimeType : ''
                } )
                upload.on( 'httpUploadProgress', ( progress: aws.S3.ManagedUpload.Progress ) => {

                    cli.progress( ( i + ( progress.loaded / progress.total ) ) / localFileCount )

                } )
                await upload.promise()
                i++

            }

            const invalidationQuery = options.invalids as {distId:string, invalidPaths:string[]}[]

            if ( invalidationQuery.length > 0 ) {

                cli.info( 'start create invalidation ...' )

                const cf: aws.CloudFront = new aws.CloudFront()

                try {

                    for ( const invalid of invalidationQuery ) {

                        const { distId, invalidPaths } = invalid

                        invalidProp = []
                        verifyValid( invalid,
                            [
                                'distId',
                                'invalidPaths'
                            ],
                            invalidProp
                        )

                        if ( invalidProp.length === 1 && invalidProp[ 0 ] === 'invalidPaths' ) {

                            cli.error( `id ${distId} "invalidPaths" not set value.` )
                            continue

                        }

                        formatInvalidPaths( invalidPaths )
                        await cf.createInvalidation( { DistributionId: distId, InvalidationBatch: { Paths: { Items: invalidPaths, Quantity: invalidPaths.length }, CallerReference: getTimestamp().toString() } } ).promise()

                    }

                } catch ( e ) {

                    cli.error( e )
                    exitCode = 1

                }

            }

        } catch ( e ) {

            cli.error( e )
            exitCode = 1

        }

    }

    cli.exit( exitCode )

}

function deployCfgToOpt ( {
    aws, s3, cloudFront
}: DeployCfg, opt: any ) {

    if ( aws.key ) opt.key = aws.key
    if ( aws.secret ) opt.secret = aws.secret
    if ( s3.region ) opt.region = s3.region
    if ( s3.bucket ) opt.bucket = s3.bucket
    if ( s3.to ) opt.deployTo = s3.to
    if ( s3.source ) opt.source = s3.source
    if ( cloudFront ) {

        opt.invalids = cloudFront instanceof Array ?
            cloudFront.map( ( v ) => ( { distId: v.distributionId, invalidPaths: v.invalidation.paths } ) ) :
            [ { distId: cloudFront.distributionId, invalidPaths: cloudFront.invalidation.paths } ]

    }

}

function getDeployCfgByOpt ( opt: any ) {

    const cfg: DeployCfg = {
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
    }

    if ( opt.distId ) {

        cfg.cloudFront = {
            distributionId: opt.distId,
            invalidation: { paths: opt.invalidPaths }
        }

    }
    return cfg

}

function getTimestamp (): number {

    const dateTime = Date.now()
    return Math.floor( dateTime / 1000 )

}

function formatOpt2nd ( opt: any ) {

    if ( typeof ( opt.invalidPaths ) == 'string' ) {

        opt.invalidPaths = JSON.parse( opt.invalidPaths )

    }

}

function formatInvalidPaths ( paths: string[] ) {

    for ( let i = 0; i < paths.length; i++ ) {

        const path = paths[ i ]
        if ( path.charAt( 0 ) !== '/' ) paths[ i ] = '/' + path

    }

}

function verifyValid ( target: Record<string, any>, propNames: string[], outInvalidOut: null | string[] = null ): boolean {

    let result = true
    for ( let i = 0; i < propNames.length; i++ ) {

        const propName = propNames[ i ]
        if ( target[ propName ] ) {

            if ( target[ propName ] == null || target[ propName ] === undefined ) {

                result = false
                if ( outInvalidOut != null ) outInvalidOut.push( propName )

            }

        } else {

            result = false
            if ( outInvalidOut != null ) outInvalidOut.push( propName )

        }

    }
    return result

}

function getFileRelativePathList ( dirPath: string, outList: PathDict, relativeStart = '' ): number {

    !dirPath && ( dirPath = '.' )

    if ( !fs.existsSync( dirPath ) || !fs.lstatSync( dirPath ).isDirectory ) return 0

    let count = 0

    const list: string[] = fs.readdirSync( dirPath )

    for ( let i = 0; i < list.length; i++ ) {

        const name = list[ i ]

        const aPath = path.join( dirPath, name )
        const rPath = relativeStart.length > 0 ? path.join( relativeStart, name ) : name
        const entry = fs.lstatSync( aPath )

        if ( entry.isDirectory() ) {

            count += getFileRelativePathList( aPath, outList, rPath )

        } else {

            outList[ rPath.replace( /\\/g, '/' ) ] = aPath
            count++

        }

    }

    return count

}

function createCfgName ( rootCfg: RootCfg | null ): string {

    let i = 1
    if ( rootCfg ) {

        while ( true ) {

            const name = `deploy${i}`
            if ( !( rootCfg[ name ] ) ) return name
            i++

        }

    }
    return `deploy${i}`

}
