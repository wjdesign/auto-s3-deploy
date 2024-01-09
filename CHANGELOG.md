# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.0.7](https://gitlab.xtremegaming.cc/s900712z/auto-s3-deploy/compare/v0.0.6...v0.0.7) (2022-03-17)


### Features

* cloudfront 支援多對象 ([26345ea](https://gitlab.xtremegaming.cc/s900712z/auto-s3-deploy/commit/26345ea213fa74a8a1c13eb87cea5d246c96c927))

### [0.0.6](http://gitlab.suote.com.tw:2222/s900712z/auto-s3-deploy/compare/v0.0.5...v0.0.6) (2020-11-10)


### Bug Fixes

* 當 deployTo 設定成空字串時，會導致上傳到 S3 的名為 '/' 的目錄裡 ([63b3a71](http://gitlab.suote.com.tw:2222/s900712z/auto-s3-deploy/commit/63b3a711b1100ad7f4a5b75dcf840b9fc5d5f785))

### [0.0.5](http://gitlab.suote.com.tw:2222/s900712z/auto-s3-deploy/compare/v0.0.4...v0.0.5) (2020-10-12)


### Bug Fixes

* s3.listObjects 機制仍不完整，導致線上目錄檔案超出 1000 個仍無法全部辨認 ([bed7b6f](http://gitlab.suote.com.tw:2222/s900712z/auto-s3-deploy/commit/bed7b6ff16403e06e17e2a3971176054cb28152b))

### [0.0.4](http://gitlab.suote.com.tw:2222/s900712z/auto-s3-deploy/compare/v0.0.3...v0.0.4) (2020-07-30)


### Features

* s3.listObjects 加入 Prefix 讓回傳的資料不會輕易超過上限 1000 ([d5abe3f](http://gitlab.suote.com.tw:2222/s900712z/auto-s3-deploy/commit/d5abe3f683f24ded708bdfc4659a30966ea2bce8))

### [0.0.3](http://gitlab.suote.com.tw:2222/s900712z/auto-s3-deploy/compare/v0.0.2...v0.0.3) (2019-11-27)


### Features

* 當 cover-deploy.json 沒有加入 .gitignore 則發出警告 ([9211ccc](http://gitlab.suote.com.tw:2222/s900712z/auto-s3-deploy/commit/9211ccc063228ad5400c4331efd06f632b8a1512))

### [0.0.2](http://gitlab.suote.com.tw:2222/s900712z/auto-s3-deploy/compare/v0.0.1...v0.0.2) (2019-11-27)


### Bug Fixes

* 沒有 cover-deploy.json 就會報錯 ([47946d7](http://gitlab.suote.com.tw:2222/s900712z/auto-s3-deploy/commit/47946d7a3aaf4d8539421c5dbb3b390c6ae5bac3))

### [0.0.1](http://gitlab.suote.com.tw:2222/s900712z/auto-s3-deploy/compare/v0.0.0...v0.0.1) (2019-11-26)


### Features

* 支援設定覆寫檔 cover-deploy.json ([cfabe69](http://gitlab.suote.com.tw:2222/s900712z/auto-s3-deploy/commit/cfabe6992ed6b44685a8aa3f3f0781315edde124))

## 0.0.0 (2019-10-25)


### Features

* 雛型完成 db37919
