import { handler } from "../createTask";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

jest.mock("../../../utils/dynamo", () => ({
  dynamo: { send: jest.fn().mockResolvedValue({}) },
  TASKS_TABLE: "tasks",
  USERS_TABLE: "users",
}));

const makeEvent = (
  body: object,
  groups: string[] = ["Admins"]
): APIGatewayProxyEventV2WithJWTAuthorizer =>
  ({
    body: JSON.stringify(body),
    pathParameters: {},
    requestContext: {
      authorizer: {
        jwt: {
          claims: {
            sub: "user-123",
            email: "admin@amalitech.com",
            "cognito:groups": groups.join(","),
          },
        },
      },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer);

describe("createTask", () => {
  it("creates a task when called by an admin", async () => {
    const result = await handler(makeEvent({ title: "Fix bug", description: "Critical bug" }));
    expect((result as any).statusCode).toBe(201);
    const body = JSON.parse((result as any).body);
    expect(body.title).toBe("Fix bug");
    expect(body.status).toBe("OPEN");
    expect(body.assignedTo).toEqual([]);
  });

  it("returns 403 when called by a member", async () => {
    const result = await handler(makeEvent({ title: "Task" }, ["Members"]));
    expect((result as any).statusCode).toBe(403);
  });

  it("returns 400 when title is missing", async () => {
    const result = await handler(makeEvent({ description: "No title" }));
    expect((result as any).statusCode).toBe(400);
  });

  it("returns 400 when description is missing", async () => {
    const result = await handler(makeEvent({ title: "No desc" }));
    expect((result as any).statusCode).toBe(400);
  });

  it("returns 400 when body is empty", async () => {
    const result = await handler(makeEvent({}));
    expect((result as any).statusCode).toBe(400);
  });
});
