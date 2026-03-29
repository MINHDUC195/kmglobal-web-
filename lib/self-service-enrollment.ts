import { NextResponse } from "next/server";
import { SELF_SERVICE_ENROLLMENT_FORBIDDEN } from "./self-service-enrollment-messages";

export { SELF_SERVICE_ENROLLMENT_FORBIDDEN } from "./self-service-enrollment-messages";

export function isRoleBlockedFromSelfServiceEnrollment(
  role: string | null | undefined
): boolean {
  return role === "admin" || role === "owner";
}

export function jsonSelfServiceEnrollmentForbidden(): NextResponse {
  return NextResponse.json(
    { error: SELF_SERVICE_ENROLLMENT_FORBIDDEN },
    { status: 403 }
  );
}
