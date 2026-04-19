import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { GetCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TASKS_TABLE, USERS_TABLE } from "../../utils/dynamo";
import type { Task, User } from "../../types";

const ses = new SESClient({ region: process.env.REGION });
const FROM_EMAIL = process.env.SES_FROM!;

interface NotifyEvent {
  taskId: string;
  event: "TASK_ASSIGNED" | "STATUS_CHANGE";
  assignedTo: string[];
  triggeredBy: string;
}

export const handler = async (event: NotifyEvent): Promise<void> => {
  const { taskId, event: eventType, assignedTo, triggeredBy } = event;

  const taskResult = await dynamo.send(
    new GetCommand({ TableName: TASKS_TABLE, Key: { taskId } })
  );
  if (!taskResult.Item) return;

  const task = taskResult.Item as Task;

  const userIds = [...new Set([...assignedTo, triggeredBy])];
  const users = await fetchUsers(userIds);

  if (eventType === "TASK_ASSIGNED") {
    await sendAssignmentEmails(task, assignedTo, users);
  } else if (eventType === "STATUS_CHANGE") {
    await sendStatusChangeEmails(task, assignedTo, users, triggeredBy);
  }
};

async function fetchUsers(userIds: string[]): Promise<Map<string, User>> {
  if (userIds.length === 0) return new Map();

  const result = await dynamo.send(
    new BatchGetCommand({
      RequestItems: {
        [USERS_TABLE]: {
          Keys: userIds.map((userId) => ({ userId })),
        },
      },
    })
  );

  const users = new Map<string, User>();
  for (const item of result.Responses?.[USERS_TABLE] ?? []) {
    users.set(item.userId, item as User);
  }
  return users;
}

async function sendAssignmentEmails(
  task: Task,
  assignedTo: string[],
  users: Map<string, User>
): Promise<void> {
  for (const userId of assignedTo) {
    const user = users.get(userId);
    if (!user) continue;

    await ses.send(
      new SendEmailCommand({
        Source: FROM_EMAIL,
        Destination: { ToAddresses: [user.email] },
        Message: {
          Subject: { Data: `You have been assigned a task: ${task.title}` },
          Body: {
            Text: {
              Data: `Hi,\n\nYou have been assigned the following task:\n\nTitle: ${task.title}\nDescription: ${task.description}\nStatus: ${task.status}\n\nPlease log in to view your tasks.\n\nTask Management System`,
            },
          },
        },
      })
    );
  }
}

async function sendStatusChangeEmails(
  task: Task,
  assignedTo: string[],
  users: Map<string, User>,
  triggeredBy: string
): Promise<void> {
  // Notify all assigned members except the one who made the change
  const recipients = assignedTo.filter((id) => id !== triggeredBy);

  for (const userId of recipients) {
    const user = users.get(userId);
    if (!user) continue;

    await ses.send(
      new SendEmailCommand({
        Source: FROM_EMAIL,
        Destination: { ToAddresses: [user.email] },
        Message: {
          Subject: { Data: `Task status updated: ${task.title}` },
          Body: {
            Text: {
              Data: `Hi,\n\nThe status of a task you're assigned to has been updated.\n\nTitle: ${task.title}\nNew Status: ${task.status}\n\nTask Management System`,
            },
          },
        },
      })
    );
  }
}
