declare module 'katex/contrib/auto-render' {
  interface AutoRenderOptions {
    delimiters?: { left: string; right: string; display: boolean }[];
    throwOnError?: boolean;
    ignoredTags?: string[];
  }
  const renderMathInElement: (element: HTMLElement, options?: AutoRenderOptions) => void;
  export default renderMathInElement;
}
