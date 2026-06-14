import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { env } from "@/server/env";

export const roleClaimType =
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
export const givenNameClaimType =
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname";
export const surnameClaimType =
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname";
export const nameIdentifierClaimType =
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";

export type JarvisClaims = JWTPayload & {
  email?: string;
  role?: string;
  role_name?: string | string[];
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  nameid?: string;
  userId?: string;
  user_id?: string;
  id?: string;
  [roleClaimType]?: string | string[];
  [givenNameClaimType]?: string;
  [surnameClaimType]?: string;
  [nameIdentifierClaimType]?: string;
};

export type JwtUser = {
  Id: number;
  Email: string;
  RoleId: number;
  Firstname: string;
  MiddleName: string | null;
  LastName: string;
};

export type IssuedToken = {
  accessToken: string;
  expiresAtUtc: string;
};

function jwtSecretKey() {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required for JWT operations.");
  }

  return new TextEncoder().encode(env.JWT_SECRET);
}

function singleOrArray(values: string[]) {
  if (values.length === 0) {
    return undefined;
  }

  return values.length === 1 ? values[0] : values;
}

export function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function issueJwt(user: JwtUser, roleNames: string[]): Promise<IssuedToken> {
  const expiresAt = new Date(Date.now() + env.JWT_EXPIRY_MINUTES * 60 * 1000);
  const normalizedRoleNames = [
    ...new Map(
      roleNames
        .map((roleName) => roleName.trim())
        .filter(Boolean)
        .map((roleName) => [roleName.toLowerCase(), roleName]),
    ).values(),
  ];

  const payload: JarvisClaims = {
    email: user.Email,
    role: String(user.RoleId),
    [nameIdentifierClaimType]: String(user.Id),
  };

  const roleValue = singleOrArray(normalizedRoleNames);
  if (roleValue) {
    payload.role_name = roleValue;
    payload[roleClaimType] = roleValue;
  }

  if (user.Firstname.trim()) {
    payload.given_name = user.Firstname;
    payload[givenNameClaimType] = user.Firstname;
  }

  if (user.MiddleName?.trim()) {
    payload.middle_name = user.MiddleName;
  }

  if (user.LastName.trim()) {
    payload.family_name = user.LastName;
    payload[surnameClaimType] = user.LastName;
  }

  let token = new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.Id))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000));

  if (env.JWT_ISSUER) {
    token = token.setIssuer(env.JWT_ISSUER);
  }

  if (env.JWT_AUDIENCE) {
    token = token.setAudience(env.JWT_AUDIENCE);
  }

  return {
    accessToken: await token.sign(jwtSecretKey()),
    expiresAtUtc: expiresAt.toISOString(),
  };
}

export async function verifyJwt(token: string): Promise<JarvisClaims> {
  const options = {
    issuer: env.JWT_ISSUER || undefined,
    audience: env.JWT_AUDIENCE || undefined,
  };

  const result = await jwtVerify(token, jwtSecretKey(), options);
  return result.payload as JarvisClaims;
}

export function getUserIdFromClaims(claims: JarvisClaims) {
  const candidates = [
    claims.sub,
    claims[nameIdentifierClaimType],
    claims.nameid,
    claims.userId,
    claims.user_id,
    claims.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const userId = Number.parseInt(candidate, 10);
    if (Number.isInteger(userId) && userId > 0) {
      return userId;
    }
  }

  return null;
}
