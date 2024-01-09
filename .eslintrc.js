module.exports = {
    root: true,
    env: {
        browser: true,
        node: true
    },
    parserOptions: { parser: '@typescript-eslint/parser' },
    extends: [ 'plugin:@typescript-eslint/recommended', 'standard' ],
    plugins: [ '@typescript-eslint' ],
    // add your custom rules here

    rules: {
        curly: [ 'error' ],
        // 'lines-between-class-members': [ 'error', 'always' ],
        'padded-blocks': [ 'error', { blocks: 'always' } ],
        'object-curly-newline': [ 'error', { multiline: true, minProperties: 3 } ],
        'object-property-newline': [ 'error' ],
        'space-in-parens': [ 'error', 'always' ],
        'computed-property-spacing': [ 'error', 'always' ],
        'array-bracket-spacing': [ 'error', 'always' ],
        'array-bracket-newline': [ 'error', { multiline: true, minItems: 3 } ],
        'brace-style': [ 'error' ],
        eqeqeq: [ 'error', 'smart' ],
        indent: [ 'error', 4 ],
        'linebreak-style': [ 'error', 'unix' ],
        'operator-linebreak': [ 'error', 'after' ],
        quotes: [ 'error', 'single' ],
        'no-redeclare': 'off',
        '@typescript-eslint/no-redeclare': [ 'error' ]
    },
    overrides: [
        {
            // enable the rule specifically for TypeScript files
            files: [ '*.ts', '*.tsx' ],
            rules: {
                /**
         * TypeScript (包含Vue中的TS) 中的 type、interface、... 等一些定義不能被 ESLint 辨識，
         * 會經常性報 'no-undef'、'no-unused-vars'，所以予以關閉
         * 該檢查功能應該交給 TS 編譯器檢查 (例如從 tsconfig.json 中設定)
         */
                'no-undef': 'off',
                'no-unused-vars': 'off',

                // 支援重載

                'no-dupe-class-members': 'off',
                '@typescript-eslint/no-dupe-class-members': [ 'error' ],

                'space-before-function-paren': 'off',
                '@typescript-eslint/space-before-function-paren': [ 'error' ],

                'interface-name-prefix': 'off',
                'ban-ts-ignore': 'off',
                '@typescript-eslint/explicit-function-return-type': 'off',
                '@typescript-eslint/explicit-module-boundary-types': 'off'
            }
        }
    ]
}
