/// <reference types="vite/client" />
/// <reference types="@file-viewer/vite-plugin/client" />

declare module '*.css' {
  const url: string;
  export default url;
}
