import { handler } from "../assignTask";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { dynamo } from "../../../utils/dynamo";

jest.mock("../../../utils/dynamo", () => ({
  dynamo: { send: jest.fn() },
  TASKS_TABLE: "tasks",
  USERS_TABLE: "users",
}));

jest.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: jest.fn(() => ({ send: jest.fn().mockResolvedValue({}) })),
  InvokeCommand: jest.fn(),
}));

const mockSend = dynamo.send as jest.Mock;

const openTask = {
  taskId: "t-1",
  title: "Bug",
  description: "Fix it",
  status: "OPEN",
  createdBy: "admin-1",
  assignedTo: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const activeUser = { userId: "member-1", email: "m@amalitech.com", status: "ACTIVE" };

const makeEvent = (
  body: object,
  taskId: string | null = "t-1",
  groups: string[] = ["Admins"]
): APIGatewayProxyEventV2WithJWTAuthorizer =>
  ({
    body: JSON.stringify(body),
    pathParameters: taskId ? { taskId } : {},
    requestContext: {
      authorizer: {
        jwt: {
          claims: {
            sub: "admin-1",
            email: "admin@amalitech.com",
            "cognito:groups": groups.join(","),
          },
        },
      },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer);

beforeEach(() => mockSend.mockReset());

describe("assignTask", () => {
  it("returns 403 when called by a member", async () => {
    const res = await handler(makeEvent({ userIds: ["m-1"] }, "t-1", ["Members"]));
    expect((res as any).statusCode).toBe(403);
  });

  it("returns 400 when taskId is missing", async () => {
    const res = await handler(makeEvent({ userIds: ["m-1"] }, null));
    expect((res as any).statusCode).toBe(400);
  });

  it("returns 400 when userIds is empty", async () => {
    const res = await handler(makeEvent({ userIds: [] }));
    expect((res as any).statusCode).toBe(400);
  });

  it("returns 400 when userIds is not an array", async () => {
    const res = await handler(makeEvent({ userIds: "member-1" }));
    expect((res as any).statusCode).toBe(400);
  });

  it("returns 404 when task does not exist", async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    const res = await handler(makeEvent({ userIds: ["member-1"] }));
    expect((res as any).statusCode).toBe(404);
  });

  it("returns 400 when task is already closed", async () => {
    mockSend.mockResolvedValueOnce({ Item: { ...openTask, status: "CLOSED" } });
    const res = await handler(makeEvent({ userIds: ["member-1"] }));
    expect((res as any).statusCode).toBe(400);
  });

  it("returns 404 when user does not exist", async () => {
    mockSend
      .mockResolvedValueOnce({ Item: openTask })
      .mockResolvedValueOnce({ Item: undefined });
    const res = await handler(makeEvent({ userIds: ["member-1"] }));
    expect((res as any).statusCode).toBe(404);
  });

  it("returns 400 when user is inactive", async () => {
    mockSend
      .mockResolvedValueOnce({ Item: openTask })
      .mockResolvedValueOnce({ Item: { ...activeUser, status: "INACTIVE" } });
    const res = await handler(makeEvent({ userIds: ["member-1"] }));
    expect((res as any).statusCode).toBe(400);
  });

  it("returns 409 on duplicate assignment", async () => {
    const alreadyAssigned = { ...openTask, assignedTo: ["member-1"] };
    mockSend
      .mockResolvedValueOnce({ Item: alreadyAssigned })
      .mockResolvedValueOnce({ Item: activeUser });
    const res = await handler(makeEvent({ userIds: ["member-1"] }));
    expect((res as any).statusCode).toBe(409);
  });

  it("assigns users and returns 200", async () => {
    const updated = { ...openTask, assignedTo: ["member-1"] };
    mockSend
      .mockResolvedValueOnce({ Item: openTask })
      .mockResolvedValueOnce({ Item: activeUser })
      .mockResolvedValueOnce({ Attributes: updated });
    const res = await handler(makeEvent({ userIds: ["member-1"] }));
    expect((res as any).statusCode).toBe(200);
  });

  it("returns 500 when dynamo throws", async () => {
    mockSend.mockRejectedValueOnce(new Error("DB error"));
    const res = await handler(makeEvent({ userIds: ["member-1"] }));
    expect((res as any).statusCode).toBe(500);
  });
});
