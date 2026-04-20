import { handler } from "../getTask";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { dynamo } from "../../../utils/dynamo";

jest.mock("../../../utils/dynamo", () => ({
  dynamo: { send: jest.fn() },
  TASKS_TABLE: "tasks",
  USERS_TABLE: "users",
}));

const mockSend = dynamo.send as jest.Mock;

const task = {
  taskId: "t-1",
  title: "Test",
  description: "Desc",
  status: "OPEN",
  createdBy: "admin-1",
  assignedTo: ["member-1"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const makeEvent = (
  taskId: string | undefined,
  groups: string[],
  sub = "admin-1"
): APIGatewayProxyEventV2WithJWTAuthorizer =>
  ({
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

beforeEach(() => mockSend.mockReset());

describe("getTask", () => {
  it("returns 400 when taskId is missing", async () => {
    const res = await handler(makeEvent(undefined, ["Admins"]));
    expect((res as any).statusCode).toBe(400);
  });

  it("returns 404 when task does not exist", async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    const res = await handler(makeEvent("t-1", ["Admins"]));
    expect((res as any).statusCode).toBe(404);
  });

  it("admin can fetch any task", async () => {
    mockSend.mockResolvedValueOnce({ Item: task });
    const res = await handler(makeEvent("t-1", ["Admins"]));
    expect((res as any).statusCode).toBe(200);
    expect(JSON.parse((res as any).body).taskId).toBe("t-1");
  });

  it("member assigned to task can fetch it", async () => {
    mockSend.mockResolvedValueOnce({ Item: task });
    const res = await handler(makeEvent("t-1", ["Members"], "member-1"));
    expect((res as any).statusCode).toBe(200);
  });

  it("member not assigned gets 403", async () => {
    mockSend.mockResolvedValueOnce({ Item: task });
    const res = await handler(makeEvent("t-1", ["Members"], "other-user"));
    expect((res as any).statusCode).toBe(403);
  });

  it("returns 500 when dynamo throws", async () => {
    mockSend.mockRejectedValueOnce(new Error("DB error"));
    const res = await handler(makeEvent("t-1", ["Admins"]));
    expect((res as any).statusCode).toBe(500);
  });
});
