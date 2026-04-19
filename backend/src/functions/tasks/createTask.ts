import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { dynamo, TASKS_TABLE } from "../../utils/dynamo";
import { getClaims, requireAdmin } from "../../middleware/rbac";
import { created, forbidden, badRequest, internalError } from "../../utils/response";

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const claims = getClaims(event);

    if (!requireAdmin(claims)) {
      return forbidden("Only admins can create tasks.");
    }

    const body = JSON.parse(event.body ?? "{}");
    const { title, description } = body;

    if (!title?.trim() || !description?.trim()) {
      return badRequest("title and description are required.");
    }

    const task = {
      taskId: randomUUID(),
      title: title.trim(),
      description: description.trim(),
      status: "OPEN",
      createdBy: claims.sub,
      assignedTo: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dynamo.send(
      new PutCommand({
        TableName: TASKS_TABLE,
        Item: task,
        ConditionExpression: "attribute_not_exists(taskId)",
      })
    );

    return created(task);
  } catch (err) {
    console.error("createTask error:", err);
    return internalError();
  }
};
