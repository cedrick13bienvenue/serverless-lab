import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TASKS_TABLE } from "../../utils/dynamo";
import { getClaims, requireAdmin } from "../../middleware/rbac";
import { ok, forbidden, badRequest, notFound, internalError } from "../../utils/response";
import type { Task } from "../../types";

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const claims = getClaims(event);

    if (!requireAdmin(claims)) {
      return forbidden("Only admins can close tasks.");
    }

    const taskId = event.pathParameters?.taskId;
    if (!taskId) return badRequest("taskId is required.");

    const existing = await dynamo.send(
      new GetCommand({ TableName: TASKS_TABLE, Key: { taskId } })
    );
    if (!existing.Item) return notFound("Task not found.");

    const task = existing.Item as Task;
    if (task.status === "CLOSED") {
      return badRequest("Task is already closed.");
    }

    // Soft-delete: set status to CLOSED rather than hard-deleting
    const updated = await dynamo.send(
      new UpdateCommand({
        TableName: TASKS_TABLE,
        Key: { taskId },
        UpdateExpression: "SET #s = :s, updatedAt = :u",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":s": "CLOSED",
          ":u": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
    );

    return ok(updated.Attributes);
  } catch (err) {
    console.error("deleteTask error:", err);
    return internalError();
  }
};
