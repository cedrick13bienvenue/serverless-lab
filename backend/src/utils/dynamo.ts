import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: process.env.REGION ?? "eu-west-1" });

export const dynamo = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TASKS_TABLE = process.env.TASKS_TABLE!;
export const USERS_TABLE = process.env.USERS_TABLE!;
