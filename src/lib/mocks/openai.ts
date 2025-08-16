// Minimal browser-safe mock of OpenAI SDK used only for type/shape compatibility in UI.
export class OpenAI {
  apiKey?: string;
  baseURL?: string;
  dangerouslyAllowBrowser?: boolean;
  constructor(opts: { apiKey?: string; baseURL?: string; dangerouslyAllowBrowser?: boolean }) {
    this.apiKey = opts.apiKey;
    this.baseURL = opts.baseURL;
    this.dangerouslyAllowBrowser = opts.dangerouslyAllowBrowser;
  }
  // simple chat.completions.create mock
  chat = {
    completions: {
      create: async (_: any) => ({ id: "mock", choices: [{ message: { content: "" } }] }),
    },
  } as any;
}
