/**
 * Barrel types công khai — import từ `types/database` như trước.
 * Định nghĩa chi tiết nằm trong `types/domain/`; schema Postgres sinh tự động trong `database.generated.ts`.
 */

export type { Database } from "./database.generated";
export type {
  ProfileHeaderSnippet,
  ProfileRowForLoginRedirect,
} from "./domain/profile";
