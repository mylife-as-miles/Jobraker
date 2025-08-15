// Basic mocks for @reactive-resume/parser used for import/export UI flows.
export type ReactiveResumeV3 = any;
export type LinkedIn = any;
export type JsonResume = any;

export class ReactiveResumeParser {
  async readFile(file: File) { return JSON.parse(await file.text()); }
  validate(data: any) { return data; }
  convert(data: any) { return data; }
}
export class ReactiveResumeV3Parser {
  async readFile(file: File) { return JSON.parse(await file.text()); }
  validate(data: any) { return data; }
  convert(data: any) { return data; }
}
export class JsonResumeParser {
  async readFile(file: File) { return JSON.parse(await file.text()); }
  validate(data: any) { return data; }
  convert(data: any) { return data; }
}
export class LinkedInParser {
  async readFile(file: File) { return file; }
  async validate(data: any) { return data; }
  convert(data: any) { return data; }
}
