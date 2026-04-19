import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import type { JwtClaims, UserRole } from "../types";

export function getClaims(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): JwtClaims {
  const claims = event.requestContext.authorizer.jwt.claims;
  return {
    sub: claims["sub"] as string,
    email: claims["email"] as string,
    "cognito:groups": claims["cognito:groups"]
      ? (claims["cognito:groups"] as string).split(",")
      : [],
  };
}

export function getRole(claims: JwtClaims): UserRole {
  const groups = claims["cognito:groups"] ?? [];
  return groups.includes("Admins") ? "Admin" : "Member";
}

export function requireAdmin(claims: JwtClaims): boolean {
  return getRole(claims) === "Admin";
}
