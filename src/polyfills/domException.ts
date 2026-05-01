// Polyfill for React Native runtimes where DOMException is undefined.
if (typeof globalThis.DOMException === "undefined") {
  class PolyfilledDOMException extends Error {
    name: string;

    constructor(message?: string, name = "Error") {
      super(message);
      this.name = name;
    }
  }

  (globalThis as any).DOMException = PolyfilledDOMException;
}
