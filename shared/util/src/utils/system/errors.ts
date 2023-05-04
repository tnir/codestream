import { ResponseError } from "vscode-languageserver-protocol";

export function isResponseError<T>(obj: unknown): obj is ResponseError<T> {
  if (!obj) {
    return false;
  }
  return (
    Object.prototype.hasOwnProperty.call(obj, "code") &&
    Object.prototype.hasOwnProperty.call(obj, "message") &&
    Object.prototype.hasOwnProperty.call(obj, "data")
  );
}