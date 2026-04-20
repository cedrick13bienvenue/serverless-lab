import { handler } from "../deleteTask";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { dynamo } from "../../../utils/dynamo";

jest.mock("../../../utils/dynamo", () => ({
  dynamo: { send: jest.fn() },
  TASKS_TABLE: "tasks",
  USERS_TABLE: "users",
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

const makeEvent = (
  taskId: string | undefined,
  groups: string[] = ["Admins"]
): APIGatewayProxyEventV2WithJWTAuthorizer =>
  ({
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

describe("deleteTask", () => {
  it("returns 403 when called by a member", async () => {
    const res = await handler(makeEvent("t-1", ["Members"]));
    expect((res as any).statusCode).toBe(403);
  });

  it("returns 400 when taskId is missing", async () => {
    const res = await handler(makeEvent(undefined));
    expect((res as any).statusCode).toBe(400);
  });

  it("returns 404 when task does not exist", async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    const res = await handler(makeEvent("t-1"));
    expect((res as any).statusCode).toBe(404);
  });

  it("returns 400 when task is already closed", async () => {
    mockSend.mockResolvedValueOnce({ Item: { ...openTask, status: "CLOSED" } });
    const res = await handler(makeEvent("t-1"));
    expect((res as any).statusCode).toBe(400);
  });

  it("soft-closes an open task and returns 200", async () => {
    const closed = { ...openTask, status: "CLOSED" };
    mockSend
      .mockResolvedValueOnce({ Item: openTask })
      .mockResolvedValueOnce({ Attributes: closed });
    const res = await handler(makeEvent("t-1"));
    expect((res as any).statusCode).toBe(200);
    expect(JSON.parse((res as any).body).status).toBe("CLOSED");
  });

  it("returns 500 when dynamo throws", async () => {
    mockSend.mockRejectedValueOnce(new Error("DB error"));
    const res = await handler(makeEvent("t-1"));
    expect((res as any).statusCode).toBe(500);
  });
});
