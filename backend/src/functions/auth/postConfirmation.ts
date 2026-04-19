import type { PostConfirmationTriggerHandler } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, USERS_TABLE } from "../../utils/dynamo";

export const handler: PostConfirmationTriggerHandler = async (event) => {
  const { sub, email } = event.request.userAttributes;

  await dynamo.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        userId: sub,
        email,
        role: "Member",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
      },
      ConditionExpression: "attribute_not_exists(userId)",
    })
  );

  return event;
};
