// Lets TypeScript accept `import url from "./font.woff2"`.
// Remotion's bundler turns such imports into a URL string for the file.
declare module "*.woff2" {
  const url: string;
  export default url;
}
