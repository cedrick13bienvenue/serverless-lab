import { handler } from "../postConfirmation";
import type { PostConfirmationTriggerEvent, Context, Callback } from "aws-lambda";
import { dynamo } from "../../../utils/dynamo";

jest.mock("../../../utils/dynamo", () => ({
  dynamo: { send: jest.fn().mockResolvedValue({}) },
  USERS_TABLE: "users",
  TASKS_TABLE: "tasks",
}));

const mockSend = dynamo.send as jest.Mock;

const makeEvent = (sub: string, email: string): PostConfirmationTriggerEvent =>
  ({
    request: { userAttributes: { sub, email } },
    response: {},
  } as unknown as PostConfirmationTriggerEvent);

describe("postConfirmation", () => {
  beforeEach(() => mockSend.mockClear());

  it("puts a new user record into DynamoDB and returns the event", async () => {
    const event = makeEvent("user-abc", "alice@amalitech.com");
    const result = await handler(event, {} as Context, {} as unknown as Callback);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const putInput = mockSend.mock.calls[0][0].input;
    expect(putInput.Item.userId).toBe("user-abc");
    expect(putInput.Item.email).toBe("alice@amalitech.com");
    expect(putInput.Item.role).toBe("Member");
    expect(putInput.Item.status).toBe("ACTIVE");
    expect(putInput.ConditionExpression).toBe("attribute_not_exists(userId)");
    expect(result).toEqual(event);
  });

  it("records a createdAt timestamp on the new user", async () => {
    const before = new Date().toISOString();
    await handler(makeEvent("u2", "b@amalitech.com"), {} as Context, {} as unknown as Callback);
    const putInput = mockSend.mock.calls[0][0].input;
    expect(putInput.Item.createdAt >= before).toBe(true);
  });
});
