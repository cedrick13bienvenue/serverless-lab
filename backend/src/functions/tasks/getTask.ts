import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TASKS_TABLE } from "../../utils/dynamo";
import { getClaims, requireAdmin } from "../../middleware/rbac";
import { ok, notFound, forbidden, badRequest, internalError } from "../../utils/response";
import type { Task } from "../../types";

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const claims = getClaims(event);
    const taskId = event.pathParameters?.taskId;

    if (!taskId) return badRequest("taskId is required.");

    const result = await dynamo.send(
      new GetCommand({ TableName: TASKS_TABLE, Key: { taskId } })
    );

    if (!result.Item) return notFound("Task not found.");

    const task = result.Item as Task;
    const isAdmin = requireAdmin(claims);

    if (!isAdmin && !task.assignedTo.includes(claims.sub)) {
      return forbidden("You are not assigned to this task.");
    }

    return ok(task);
  } catch (err) {
    console.error("getTask error:", err);
    return internalError();
  }
};
