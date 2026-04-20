import { handler } from "../getTasks";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { dynamo } from "../../../utils/dynamo";

jest.mock("../../../utils/dynamo", () => ({
  dynamo: { send: jest.fn() },
  TASKS_TABLE: "tasks",
  USERS_TABLE: "users",
}));

const mockSend = dynamo.send as jest.Mock;

const makeEvent = (
  groups: string[],
  sub = "user-1"
): APIGatewayProxyEventV2WithJWTAuthorizer =>
  ({
    pathParameters: {},
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

describe("getTasks", () => {
  it("admin receives all tasks via scan", async () => {
    const tasks = [{ taskId: "t-1" }, { taskId: "t-2" }];
    mockSend.mockResolvedValueOnce({ Items: tasks });
    const res = await handler(makeEvent(["Admins"]));
    expect((res as any).statusCode).toBe(200);
    expect(JSON.parse((res as any).body).tasks).toHaveLength(2);
  });

  it("admin with no tasks returns empty array", async () => {
    mockSend.mockResolvedValueOnce({ Items: undefined });
    const res = await handler(makeEvent(["Admins"]));
    expect((res as any).statusCode).toBe(200);
    expect(JSON.parse((res as any).body).tasks).toEqual([]);
  });

  it("member receives only assigned tasks", async () => {
    const tasks = [{ taskId: "t-1", assignedTo: ["member-1"] }];
    mockSend.mockResolvedValueOnce({ Items: tasks });
    const res = await handler(makeEvent(["Members"], "member-1"));
    expect((res as any).statusCode).toBe(200);
    expect(JSON.parse((res as any).body).tasks).toHaveLength(1);
  });

  it("member with no assigned tasks returns empty array", async () => {
    mockSend.mockResolvedValueOnce({ Items: undefined });
    const res = await handler(makeEvent(["Members"], "member-1"));
    expect((res as any).statusCode).toBe(200);
    expect(JSON.parse((res as any).body).tasks).toEqual([]);
  });

  it("user with no groups is treated as member and gets filtered tasks", async () => {
    // groups = [] → "cognito:groups": "" (falsy) → getClaims returns [] → Member role
    mockSend.mockResolvedValueOnce({ Items: [] });
    const res = await handler(makeEvent([], "no-group-user"));
    expect((res as any).statusCode).toBe(200);
  });

  it("returns 500 when dynamo throws", async () => {
    mockSend.mockRejectedValueOnce(new Error("DB error"));
    const res = await handler(makeEvent(["Admins"]));
    expect((res as any).statusCode).toBe(500);
  });
});
