import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, USERS_TABLE } from "../../utils/dynamo";
import { getClaims, requireAdmin } from "../../middleware/rbac";
import { ok, forbidden, internalError } from "../../utils/response";

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const claims = getClaims(event);
    if (!requireAdmin(claims)) {
      return forbidden("Only admins can list users.");
    }

    const result = await dynamo.send(new ScanCommand({ TableName: USERS_TABLE }));
    return ok({ users: result.Items ?? [] });
  } catch (err) {
    console.error("getUsers error:", err);
    return internalError();
  }
};
