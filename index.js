#!/usr/bin/env node

const args = process.argv.slice(2)

if (args.length > 1) {
    throw new Error('Incorrect arguments, use listModulesImports <target_name>')
}

const fs = require('fs')
const path = require('path')
const shell = require('child_process').execSync
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const sprout = require('sprout-data')
const stringify = require('json-stringify-deterministic')

const currentPath = process.cwd()

const targetModulesPath = currentPath + '\\' + (args[0] || '')

const importsMap = {}

const parseDir = (currentDir) => {
    const paths = fs.readdirSync(currentDir)

    paths.forEach((pathCur) => {
        const fullName = currentDir + '/' + pathCur
        if (fs.existsSync(fullName)) {
            const stat = fs.statSync(fullName)
            if (stat.isDirectory()) {
                if (pathCur !== 'node_modules')
                parseDir(fullName)
            }
            else {
                let ast
                if (['.js', '.jsx'].indexOf(path.extname(fullName)) !== -1) {
                    const file = fs.readFileSync(fullName).toString('utf8')
                    ast = parser.parse(file, {
                        sourceType: 'module',
                        plugins: [
                            'jsx',
                            'flow',
                            'classProperties',
                            'exportDefaultFrom'
                        ]
                    })
                }
                if (['.ts', '.tsx'].indexOf(path.extname(fullName)) !== -1) {
                    const file = fs.readFileSync(fullName).toString('utf8')
                    ast = parser.parse(file, {
                        sourceType: 'module',
                        plugins: [
                            'jsx',
                            'typescript',
                            'classProperties',
                            'exportDefaultFrom'
                        ]
                    })
                }
                if (ast) {
                    traverse(ast, {
                        CallExpression(obj) {
                            const { node } = obj
                            if (node.callee.name === 'require') {
                              const sourcePath = node.arguments[0].value
                                if (sourcePath && sourcePath[0] !== '.') {
                                    importsMap[sourcePath] = importsMap[sourcePath] || {}
                                    importsMap[sourcePath] = {
                                        ...importsMap[sourcePath],
                                        'default': true
                                    }
                                }
                            }
                        },
                        ImportDeclaration: function(path) {
                            const { node } = path
                            const { specifiers, source } = node
                            const sourcePath = source.value
                            if (sourcePath[0] !== '.') {
                                let imports = {}
                                specifiers.forEach(specifier => {
                                    if (specifier.type === 'ImportSpecifier') {
                                        imports[specifier.imported.name] = true
                                    } else if (specifier.type === 'ImportDefaultSpecifier') {
                                        imports['default'] = true
                                    } else if (specifier.type === 'ImportNamespaceSpecifier') {
                                        imports['*'] = true
                                    } else throw new Error(`Incorrect specifier: ${specifier.type}`)
                                })
                                importsMap[sourcePath] = importsMap[sourcePath] || {}
                                importsMap[sourcePath] = {
                                    ...importsMap[sourcePath],
                                    ...imports
                                }
                            }
                        }
                    })
                }
            }
        }
    })
}

parseDir(targetModulesPath)

/*const result = Object.keys(importsMap).reduce((acc, cur) => {
    const keys = Object.keys(importsMap[cur])
    cur = cur.replace('/lib/', '/').replace('/src/', '/')
    if (cur.indexOf('tinkoff-form-builder') !== -1) {
        acc[cur] = [
            ...(acc[cur] || []),
            ...keys
            ]
    }
    return acc
}, {})*/

let result = {}

Object.keys(importsMap).forEach((cur) => {
    const keys = Object.keys(importsMap[cur])
    cur = cur.replace('/lib/', '/').replace('/src/', '/')
    if (cur.indexOf('tinkoff-form-builder') !== -1) {
        keys.forEach(key => {
            result = sprout.assoc(result, [...cur.split('/'), key], true)
        })
    }
})

console.log(stringify(result, {space: '  '}))
