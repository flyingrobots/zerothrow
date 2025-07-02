export { ZeroError, type ErrorCode, type ErrorContext } from "./error";
export {
  ok, err,
  tryR, tryRSync, tryRBatch, wrap,
  type Ok, type Err, type Result
} from "./result";
export {
  ResultCombinable,
  makeCombinable,
  pipe,
  collect,
  collectAsync,
  firstSuccess
} from "./combinators";