declare module "lodash.set" {
  export default function set<T extends object>(object: T, path: string | Array<string | number>, value: any): T;
}
