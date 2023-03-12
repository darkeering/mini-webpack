export class ChangeOutputPath {
  constructor() {}

  apply(hooks) {
    hooks.emitFiles.tap('ChangeOutputPath', (context) => {
      context.changeOutputPath('./dist/bundle-plugin.js')
    })
  }
}