/**
 * Realm roles, kept dependency-free so both the moderation UI and tests can use
 * them.
 *
 * Role questions used to be answered from the realm member list, which only
 * loads once the Moderation sheet is open — so the owner saw "only owners and
 * moderators" and the entry point never rendered. `canModerateRealm` takes the
 * role *and* the realm's owner id, so ownership is known from the realm row
 * alone.
 */
export type RealmRole = "owner" | "mod" | "member";

export function normalizeRealmRole(value: unknown): RealmRole | null {
  if (value === "owner" || value === "mod" || value === "member") return value;
  return null;
}

/**
 * True when this user may moderate the realm (change channel permissions, pin,
 * kick, lock channels).
 *
 * - `role` comes from realm_role_of() / the member list when it is available.
 * - `ownerId` comes from the realm row, which is always loaded, so the owner is
 *   never locked out while the member list is still loading or failed.
 */
export function canModerateRealm(
  role: RealmRole | null | undefined,
  ownerId?: string | null,
  userId?: string | null,
): boolean {
  if (role === "owner" || role === "mod") return true;
  return Boolean(ownerId && userId && ownerId === userId);
}

export function realmRoleLabel(role: RealmRole | null | undefined): string {
  if (role === "owner") return "Owner";
  if (role === "mod") return "Moderator";
  if (role === "member") return "Member";
  return "Member";
}
