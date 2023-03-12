import fs from "fs";
import path from "path";
import parser from "@babel/parser";
import traverse from "@babel/traverse";
import ejs from "ejs";
import { transformFromAst } from "babel-core";
import { jsonLoader } from "./jsonLoader.js";
import { ChangeOutputPath } from "./ChangeOutputPath.js";
import { SyncHook } from "tapable";

let id = 0;

const webpackConfig = {
  module: {
    rules: [
      {
        test: /\.json$/,
        use: [jsonLoader],
      },
    ],
  },
  plugins: [new ChangeOutputPath()],
};

const hooks = {
  emitFiles: new SyncHook(['context']),
};

function createAst(filePath) {
  // 1. 获取文件的内容

  let source = fs.readFileSync(filePath, {
    encoding: "utf-8",
  });

  const loaders = webpackConfig.module.rules;

  const loaderContext = {
    addDeps(dep) {
      console.log("addDeps", dep);
    },
  };

  loaders.forEach(({ test, use }) => {
    if (test.test(filePath)) {
      if (Array.isArray(use)) {
        use.reverse().forEach((fn) => {
          source = fn.call(loaderContext, source);
        });
      }
    }
  });

  // 2. 获取依赖关系
  const ast = parser.parse(source, {
    sourceType: "module",
  });

  const deps = [];
  traverse.default(ast, {
    ImportDeclaration(data) {
      const value = data.node.source.value;
      deps.push(value);
    },
  });

  const { code } = transformFromAst(ast, null, {
    presets: ["env"],
  });
  return {
    filePath,
    code,
    deps,
    id: id++,
    mapping: {},
  };
}

function createGraph() {
  const mainAsset = createAst("./example/main.js");

  const queue = [mainAsset];
  for (let asset of queue) {
    asset.deps.forEach((relativePath) => {
      const child = createAst(path.resolve("./example", relativePath));
      asset.mapping[relativePath] = child.id;
      queue.push(child);
    });
  }
  return queue;
}

function initPlugins() {
  const plugins = webpackConfig.plugins;
  plugins.forEach((plugin) => {
    plugin.apply(hooks);
  });
}

initPlugins();

const graph = createGraph();

function build(graph) {
  const template = fs.readFileSync("./bundle.ejs", {
    encoding: "utf-8",
  });

  const data = graph.map((asset) => ({
    id: asset.id,
    code: asset.code,
    mapping: asset.mapping,
  }));
  const code = ejs.render(template, { data });
  let outputPath = "./dist/bundle.js";
  const context = {
    changeOutputPath(path) {
      outputPath = path
    },
  };
  hooks.emitFiles.call(context);
  fs.writeFileSync(outputPath, code);
}

build(graph);
