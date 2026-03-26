/**
 * Barrel types công khai — import từ `types/database` như trước.
 * Định nghĩa chi tiết nằm trong `types/domain/`; schema Postgres sinh tự động trong `database.generated.ts`.
 */

export type { Database, Json } from "./database.generated";
export type {
  ProfileHeaderSnippet,
  ProfileRow,
  ProfileRowForLoginRedirect,
  UserRole,
} from "./domain/profile";
export type { StudentProfileCompletionRow } from "./domain/student-profile";
