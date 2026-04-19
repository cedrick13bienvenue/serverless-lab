import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { dynamo, TASKS_TABLE, USERS_TABLE } from "../../utils/dynamo";
import { getClaims, requireAdmin } from "../../middleware/rbac";
import { ok, forbidden, badRequest, notFound, conflict, internalError } from "../../utils/response";
import type { Task, User } from "../../types";

const lambda = new LambdaClient({ region: process.env.REGION });

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const claims = getClaims(event);

    if (!requireAdmin(claims)) {
      return forbidden("Only admins can assign tasks.");
    }

    const taskId = event.pathParameters?.taskId;
    if (!taskId) return badRequest("taskId is required.");

    const body = JSON.parse(event.body ?? "{}");
    const { userIds } = body as { userIds: string[] };

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return badRequest("userIds must be a non-empty array.");
    }

    const taskResult = await dynamo.send(
      new GetCommand({ TableName: TASKS_TABLE, Key: { taskId } })
    );
    if (!taskResult.Item) return notFound("Task not found.");

    const task = taskResult.Item as Task;

    if (task.status === "CLOSED") {
      return badRequest("Cannot assign a closed task.");
    }

    // Validate all users exist and are ACTIVE
    for (const userId of userIds) {
      const userResult = await dynamo.send(
        new GetCommand({ TableName: USERS_TABLE, Key: { userId } })
      );
      if (!userResult.Item) return notFound(`User ${userId} not found.`);
      const user = userResult.Item as User;
      if (user.status !== "ACTIVE") {
        return badRequest(`User ${userId} is deactivated and cannot receive assignments.`);
      }
    }

    // Prevent duplicate assignments
    const duplicates = userIds.filter((id) => task.assignedTo.includes(id));
    if (duplicates.length > 0) {
      return conflict(`Users already assigned: ${duplicates.join(", ")}`);
    }

    const updated = await dynamo.send(
      new UpdateCommand({
        TableName: TASKS_TABLE,
        Key: { taskId },
        UpdateExpression:
          "SET assignedTo = list_append(assignedTo, :uids), updatedAt = :u",
        ExpressionAttributeValues: {
          ":uids": userIds,
          ":u": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
    );

    // Notify newly assigned members asynchronously
    await lambda.send(
      new InvokeCommand({
        FunctionName: "task-mgmt-notify",
        InvocationType: "Event",
        Payload: Buffer.from(
          JSON.stringify({
            taskId,
            event: "TASK_ASSIGNED",
            assignedTo: userIds,
            triggeredBy: claims.sub,
          })
        ),
      })
    );

    return ok(updated.Attributes);
  } catch (err) {
    console.error("assignTask error:", err);
    return internalError();
  }
};
