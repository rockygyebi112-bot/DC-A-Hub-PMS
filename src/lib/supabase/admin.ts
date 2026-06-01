import "server-only";

// `createAdminClient` and `createServiceClient` were two byte-for-byte copies
// of the same RLS-bypassing service-role client in different files. Keep this
// name for existing call sites but delegate to the single canonical factory so
// there is exactly one definition of "the dangerous client".
export { createServiceClient as createAdminClient } from "./server";
