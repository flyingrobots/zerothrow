export { ZeroError, type ErrorCode, type ErrorContext } from "./error.js";
export {
  ok, err,
  tryR, tryRSync, tryRBatch, wrap,
  type Ok, type Err, type Result
} from "./result.js";
export {
  ResultCombinable,
  makeCombinable,
  pipe,
  collect,
  collectAsync,
  firstSuccess
} from "./combinators.js";