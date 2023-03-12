export function jsonLoader(source) {
  this.addDeps('112233')
  return `export default ${JSON.stringify(source)}`
}
