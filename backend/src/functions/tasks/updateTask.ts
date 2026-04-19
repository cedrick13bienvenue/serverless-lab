import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { dynamo, TASKS_TABLE } from "../../utils/dynamo";
import { getClaims, requireAdmin } from "../../middleware/rbac";
import { ok, forbidden, badRequest, notFound, internalError } from "../../utils/response";
import type { Task, TaskStatus } from "../../types";

const lambda = new LambdaClient({ region: process.env.REGION });

const VALID_STATUSES: TaskStatus[] = ["OPEN", "IN_PROGRESS", "DONE", "CLOSED"];
const MEMBER_ALLOWED_STATUSES: TaskStatus[] = ["IN_PROGRESS", "DONE"];

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const claims = getClaims(event);
    const isAdmin = requireAdmin(claims);
    const taskId = event.pathParameters?.taskId;

    if (!taskId) return badRequest("taskId is required.");

    const existing = await dynamo.send(
      new GetCommand({ TableName: TASKS_TABLE, Key: { taskId } })
    );

    if (!existing.Item) return notFound("Task not found.");

    const task = existing.Item as Task;

    if (!isAdmin && !task.assignedTo.includes(claims.sub)) {
      return forbidden("You are not assigned to this task.");
    }

    const body = JSON.parse(event.body ?? "{}");

    if (!isAdmin) {
      // Members can only update status
      const { status } = body;
      if (!status) return badRequest("status is required.");
      if (!MEMBER_ALLOWED_STATUSES.includes(status)) {
        return badRequest(`Members can only set status to: ${MEMBER_ALLOWED_STATUSES.join(", ")}.`);
      }

      const updated = await dynamo.send(
        new UpdateCommand({
          TableName: TASKS_TABLE,
          Key: { taskId },
          UpdateExpression: "SET #s = :s, updatedAt = :u",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":s": status,
            ":u": new Date().toISOString(),
          },
          ReturnValues: "ALL_NEW",
        })
      );

      await triggerNotification(taskId, "STATUS_CHANGE", task.assignedTo, claims.sub);

      return ok(updated.Attributes);
    }

    // Admin can update title, description, status
    const { title, description, status } = body;

    if (status && !VALID_STATUSES.includes(status)) {
      return badRequest(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}.`);
    }

    const sets: string[] = ["updatedAt = :u"];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = { ":u": new Date().toISOString() };

    if (title) { sets.push("title = :t"); values[":t"] = title; }
    if (description) { sets.push("description = :d"); values[":d"] = description; }
    if (status) { sets.push("#s = :s"); names["#s"] = "status"; values[":s"] = status; }

    const updated = await dynamo.send(
      new UpdateCommand({
        TableName: TASKS_TABLE,
        Key: { taskId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      })
    );

    if (status && status !== task.status) {
      await triggerNotification(taskId, "STATUS_CHANGE", task.assignedTo, claims.sub);
    }

    return ok(updated.Attributes);
  } catch (err) {
    console.error("updateTask error:", err);
    return internalError();
  }
};

async function triggerNotification(
  taskId: string,
  event: string,
  assignedTo: string[],
  triggeredBy: string
): Promise<void> {
  await lambda.send(
    new InvokeCommand({
      FunctionName: `task-mgmt-notify`,
      InvocationType: "Event",
      Payload: Buffer.from(JSON.stringify({ taskId, event, assignedTo, triggeredBy })),
    })
  );
}
