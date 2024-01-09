# auto-s3-deploy

用於 AWS 自動同步資料到 S3 bucket 以及 自動生成 Cloudfront invalidation 的 node 快速部署 CLI 工具

```bash
Usage:
  auto-s3-deploy [OPTIONS] [ARGS]

Options:
  -k, --key STRING              AWS key
  -c, --secret STRING           AWS secret
  -r, --region STRING           S3 region
  -b, --bucket STRING           S3 bucket
  -t, --deployTo [STRING]       Bucket path (Default is .)
  -s, --source [STRING]         Source path (Default is .)
  -d, --distId STRING           CloudFront distributionId
  -i, --invalidPaths [STRING]   CloudFront invalidation paths (Default is *)
  -C, --cfg STRING              Use config in deploy.json
  -S, --save BOOL               Save current to deploy.json
  -h, --help                    Display help and usage details
```

## 基本需求

為了存取 AWS API ，以下參數是必要的，請從 AWS IAM 取得下列參數

1. key
2. secret

命令

```bash
auto-s3-deploy --key <key> --secret <secret>
```

## 同步檔案到 S3 bucket

要使用以下功能，請確保使用的 key、secret 在 IAM 有開啟以下權限

1. S3.ListBucket
2. S3.PutObject* (所有 PutObject 開頭的權限)

以下參數是必要的，請從 AWS S3 頁面取得下列參數

1. region   <區域>  ( 例如 "us-east-1"，詳細參考[這裡](https://docs.aws.amazon.com/zh_tw/AWSEC2/latest/UserGuide/using-regions-availability-zones.html) )
2. bucket   <儲存貯體>

另外兩個參數也要設定

| 參數     | 作用                                  |
| -------- | ------------------------------------- |
| source   | 要用於同步的本地資料夾路徑            |
| deployTo | 相對於 bucket 的資料夾路徑 (可不存在) |

完整命令

```bash
auto-s3-deploy --key <key> --secret <secret> --region <region> --bucket <bucket> --source <path> --deployTo <path>
```

## 清除 Cloudfront 快取，讓最新的同步生效

要使用以下功能，請確保使用的 key、secret 在 IAM 有開啟以下權限

1. CloudFront.CreateInvalidation

該動作是在 "同步檔案" 動作成功時會接著執行

以下參數是必要的，請從 AWS CloudFront 頁面取得下列參數

1. distId         <發布ID>
2. invalidPaths   <失效路徑，js陣列字串>

完整命令

```bash
auto-s3-deploy --key <key> --secret <secret> --region <region> --bucket <bucket> --source <path> --deployTo <path> --distId <id> --invalidPaths "["test/*","index.html"]"
```

## 保存設定到 deploy.json

當你命令中有使用參數 --save 時，
cli 會提示輸入相關的資料

```bash
? please input config name (deploy1)
? set default? (y/N)
```

隨後會在 cli 工作目錄下產生 deploy.json ，將您輸入的參數保存在裡面

deploy.json 的格式如下

```json
{
  "default": "deploy1",
  "configs": {
    "deploy1": {
      "aws": {
        "key": "...",
        "secret": "..."
      },
      "s3": {
        "region": "...",
        "bucket": "...",
        "source": "...",
        "to": "...",
        "acl": "..."
      },
      "cloudFront": {
        "distributionId": "...",
        "invalidation": { "paths": ["..."] }
      }
    },
    ...
  }
}
```

您也可以手動創建該檔案

> **`acl`允許的值有以下：`private`、`public-read`、`public-read-write`、`authenticated-read`、`aws-exec-read`、`bucket-owner-read`、`bucket-owner-full-control`**

## 選擇要使用的設定集

假如運行該 cli 時，工作目錄中存在 deploy.json
他將詢問你要使用哪一個設定集

```bash
? select deploy config ... (Use arrow keys)
> <current>
  deploy1
  deploy2
```

\<current> 代表目前 cli 所輸入的參數，選擇該項代表不使用任何設定集，
deploy1、deploy2 則代表存在於 (deploy.json).configs 裡面的設定集，
使用鍵盤選擇你需要的設定集，按下 enter 即可開始部屬流程

**如果 deploy.json 根物件有屬性 "default"**
，他的值指向 configs 裡面某一個設定集的話，
那之後執行該 cli 將會自動執行該設定集，而不再詢問

這個屬性會在你透過參數 --save 運行時，根據你的選擇而建立

```bash
? set default (y/N)
```

**如果呼叫時帶了參數 --cfg \<name>**
，他作用與 deploy.json 根物件屬性 "default" 相同，
不過這個參數優先度會比 "default" 屬性還高

## deploy.json 與 cli 參數混合使用

該 cli 設計成，如果執行階段有設置參數，但同時又指定了 deploy.json 的設定集時，
將優先保留 cli 的設置參數，deploy.json 設定集的參數只會填充沒有被設置的參數

譬如如下，指定了兩個參數

```bash
auto-s3-deploy --key 1234 --secret 4567
```

而又選擇了 deploy.json  的設定集 "deploy1"

```json
{
   "aws": {
     "key": "1A2B3A4D",
     "secret": "94mn0h94mv0emf02iomd02m3"
   },
   "s3": {
     "region": "us-east-1",
     "bucket": "test.com",
     "source": ".",
     "to": ".",
     "acl": "public-read"
   },
   "cloudFront": {
     "distributionId": "1A2B3A4D",
     "invalidation": { "paths": ["*"] }
   }
}
```

那這樣實際生效的是這樣的設定

```json
{
  "aws": {
    "key": "1234",    // 這裡會保留 cli 設置的參數
    "secret": "4567"  // -------------------------
  },
  "s3": {
    "region": "us-east-1",
    "bucket": "test.com",
    "source": ".",
    "to": ".",
    "acl": "public-read"
  },
  "cloudFront": {
    "distributionId": "1A2B3A4D",
    "invalidation": { "paths": ["*"] }
  }
}
```

這樣的設計可以讓如 key、secret 這類敏感數據不要包含在 deploy.json 裡面，
只在需要時透過命令列增加該參數即可，這種作法也可以使用在 CI 系統裡，
在這種情況下，deploy.json 的設定集也可以讓部分參數直接帶 null

```json
{
  "aws": {
    "key": null,
    "secret": null  
  },
  "s3": {
    "region": "us-east-1",
    "bucket": "test.com",
    "source": ".",
    "to": ".",
    "acl": "public-read"
  }
}
```

## deploy.json 與 cover-deploy.json 混合使用

cover-deploy.json 裡面的資料結構跟 deploy.json 一模一樣，
要是在 cli 的工作目錄下有發現 cover-deploy.json 的話，
他會覆寫 deploy.json 的資料，原理與[這裡](#deployjson-%e8%88%87-cli-%e5%8f%83%e6%95%b8%e6%b7%b7%e5%90%88%e4%bd%bf%e7%94%a8)相同，譬如...

* deploy.json

```json
{
  "aws": {
    "key": null,
    "secret": null  
  },
  "s3": {
    "region": "us-east-1",
    "bucket": "test.com",
    "source": ".",
    "to": ".",
    "acl": "public-read"
  },
  "cloudFront": {
    "distributionId": "1A2B3A4D",
    "invalidation": { "paths": ["*"] }
  }
}
```

* cover-deploy.json

```json
{
  "aws": {
    "key": 1234,
    "secret": 5678  
  }
}
```

* 合併結果

```json
{
  "aws": {
    "key": 1234,        // 這裡將被覆寫掉
    "secret": 5678      // --------------
  },
  "s3": {
    "region": "us-east-1",
    "bucket": "test.com",
    "source": ".",
    "to": ".",
    "acl": "public-read"
  },
  "cloudFront": {
    "distributionId": "1A2B3A4D",
    "invalidation": { "paths": ["*"] }
  }
}
```

他的目的也是在於保存敏感性資料，不保存到 git repository ，但是又可以獲得開發發布上的方便，
因為 cover-deploy.json 只允許存在您的本地目錄，不能 push 到 git repository。

如果 auto-s3-deploy 發現當前工作目錄屬於 git repository ，
卻又沒有把 cover-deploy.json 加入到 .gitignore 的話，會發出錯誤警告
