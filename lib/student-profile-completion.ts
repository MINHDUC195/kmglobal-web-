export type StudentProfileCompletionRow = {
  role?: string | null;
  full_name?: string | null;
  address_street_number?: string | null;
  address_street_name?: string | null;
  address_ward?: string | null;
  phone?: string | null;
  phone_verified_at?: string | null;
  data_sharing_consent_at?: string | null;
} | null;

export function studentProfileNeedsCompletion(profile: StudentProfileCompletionRow): boolean {
  if (!profile) return true;
  if (profile.role !== "student") return false;
  if (!profile.full_name?.trim()) return true;
  if (!profile.address_street_number?.trim()) return true;
  if (!profile.address_street_name?.trim()) return true;
  if (!profile.address_ward?.trim()) return true;
  if (!profile.phone?.trim()) return true;
  if (!profile.phone_verified_at) return true;
  if (!profile.data_sharing_consent_at) return true;
  return false;
}
