import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TASKS_TABLE } from "../../utils/dynamo";
import { getClaims, requireAdmin } from "../../middleware/rbac";
import { ok, internalError } from "../../utils/response";
import type { Task } from "../../types";

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const claims = getClaims(event);
    const isAdmin = requireAdmin(claims);

    if (isAdmin) {
      const result = await dynamo.send(
        new ScanCommand({ TableName: TASKS_TABLE })
      );
      return ok({ tasks: result.Items ?? [] });
    }

    // Members see only tasks where their userId is in assignedTo
    const result = await dynamo.send(
      new ScanCommand({
        TableName: TASKS_TABLE,
        FilterExpression: "contains(assignedTo, :uid)",
        ExpressionAttributeValues: { ":uid": claims.sub },
      })
    );

    return ok({ tasks: (result.Items ?? []) as Task[] });
  } catch (err) {
    console.error("getTasks error:", err);
    return internalError();
  }
};
