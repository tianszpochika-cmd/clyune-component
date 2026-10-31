declare module '*.js' {
  const mod: Record<string, (...args: any[]) => any>;
  export = mod;
}
