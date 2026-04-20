import { handler } from "../updateTask";
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

const existingTask = {
  taskId: "task-1",
  title: "Bug fix",
  description: "Fix it",
  status: "OPEN",
  createdBy: "admin-1",
  assignedTo: ["member-1"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const makeEvent = (
  body: object | null,
  groups: string[] = ["Admins"],
  sub = "admin-1",
  taskId: string | null = "task-1"
): APIGatewayProxyEventV2WithJWTAuthorizer =>
  ({
    body: body !== null ? JSON.stringify(body) : undefined,
    pathParameters: taskId ? { taskId } : {},
    requestContext: {
      authorizer: {
        jwt: {
          claims: {
            sub,
            email: "user@amalitech.com",
            "cognito:groups": groups.join(","),
          },
        },
      },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer);

beforeEach(() => {
  mockSend.mockReset();
  mockSend
    .mockResolvedValueOnce({ Item: existingTask })
    .mockResolvedValueOnce({ Attributes: { ...existingTask, status: "IN_PROGRESS" } });
});

describe("updateTask", () => {
  it("admin can update task status to any valid value", async () => {
    const result = await handler(makeEvent({ status: "IN_PROGRESS" }));
    expect((result as any).statusCode).toBe(200);
  });

  it("member can update status to IN_PROGRESS", async () => {
    const result = await handler(
      makeEvent({ status: "IN_PROGRESS" }, ["Members"], "member-1")
    );
    expect((result as any).statusCode).toBe(200);
  });

  it("member cannot update status to CLOSED", async () => {
    const result = await handler(
      makeEvent({ status: "CLOSED" }, ["Members"], "member-1")
    );
    expect((result as any).statusCode).toBe(400);
  });

  it("member not assigned gets 403", async () => {
    const result = await handler(
      makeEvent({ status: "IN_PROGRESS" }, ["Members"], "other-user")
    );
    expect((result as any).statusCode).toBe(403);
  });

  it("returns 404 when task does not exist", async () => {
    mockSend.mockReset();
    mockSend.mockResolvedValueOnce({ Item: undefined });
    const result = await handler(makeEvent({ status: "DONE" }));
    expect((result as any).statusCode).toBe(404);
  });

  it("admin providing an invalid status gets 400", async () => {
    mockSend.mockReset();
    mockSend.mockResolvedValueOnce({ Item: existingTask });
    const result = await handler(makeEvent({ status: "INVALID_STATUS" }));
    expect((result as any).statusCode).toBe(400);
  });

  it("returns 400 when taskId is missing", async () => {
    const result = await handler(makeEvent({ status: "IN_PROGRESS" }, ["Admins"], "admin-1", null));
    expect((result as any).statusCode).toBe(400);
  });

  it("member gets 400 when body has no status field", async () => {
    mockSend.mockReset();
    mockSend.mockResolvedValueOnce({ Item: existingTask });
    const result = await handler(makeEvent({}, ["Members"], "member-1"));
    expect((result as any).statusCode).toBe(400);
  });

  it("admin can update only title without status", async () => {
    mockSend.mockReset();
    mockSend
      .mockResolvedValueOnce({ Item: existingTask })
      .mockResolvedValueOnce({ Attributes: { ...existingTask, title: "New title" } });
    const result = await handler(makeEvent({ title: "New title" }));
    expect((result as any).statusCode).toBe(200);
  });

  it("admin update with null body defaults to empty object", async () => {
    mockSend.mockReset();
    mockSend
      .mockResolvedValueOnce({ Item: existingTask })
      .mockResolvedValueOnce({ Attributes: existingTask });
    const result = await handler(makeEvent(null));
    expect((result as any).statusCode).toBe(200);
  });

  it("returns 500 when dynamo throws", async () => {
    mockSend.mockReset();
    mockSend.mockRejectedValueOnce(new Error("DB failure"));
    const result = await handler(makeEvent({ status: "IN_PROGRESS" }));
    expect((result as any).statusCode).toBe(500);
  });
});
