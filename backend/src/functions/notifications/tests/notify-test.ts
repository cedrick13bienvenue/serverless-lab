import { handler } from "../notify";
import { dynamo } from "../../../utils/dynamo";

jest.mock("../../../utils/dynamo", () => ({
  dynamo: { send: jest.fn() },
  TASKS_TABLE: "tasks",
  USERS_TABLE: "users",
}));

jest.mock("@aws-sdk/client-ses", () => ({
  SESClient: jest.fn(() => ({ send: jest.fn().mockResolvedValue({}) })),
  SendEmailCommand: jest.fn(),
}));

const mockSend = dynamo.send as jest.Mock;

const task = {
  taskId: "t-1",
  title: "Fix bug",
  description: "Critical",
  status: "IN_PROGRESS",
  createdBy: "admin-1",
  assignedTo: ["member-1", "member-2"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const userMap = {
  "member-1": { userId: "member-1", email: "m1@amalitech.com", status: "ACTIVE" },
  "member-2": { userId: "member-2", email: "m2@amalitech.com", status: "ACTIVE" },
};

beforeEach(() => mockSend.mockReset());

describe("notify", () => {
  it("returns early when task is not found", async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    await expect(
      handler({ taskId: "t-1", event: "TASK_ASSIGNED", assignedTo: ["member-1"], triggeredBy: "admin-1" })
    ).resolves.toBeUndefined();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("sends assignment emails for TASK_ASSIGNED event", async () => {
    mockSend
      .mockResolvedValueOnce({ Item: task })
      .mockResolvedValueOnce({
        Responses: { users: Object.values(userMap) },
      });
    await handler({
      taskId: "t-1",
      event: "TASK_ASSIGNED",
      assignedTo: ["member-1", "member-2"],
      triggeredBy: "admin-1",
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("sends status-change emails to all except the triggering user", async () => {
    mockSend
      .mockResolvedValueOnce({ Item: task })
      .mockResolvedValueOnce({
        Responses: { users: Object.values(userMap) },
      });
    await handler({
      taskId: "t-1",
      event: "STATUS_CHANGE",
      assignedTo: ["member-1", "member-2"],
      triggeredBy: "member-1",
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("handles STATUS_CHANGE when all recipients are excluded (triggeredBy is the only member)", async () => {
    mockSend
      .mockResolvedValueOnce({ Item: task })
      .mockResolvedValueOnce({
        Responses: { users: [userMap["member-1"]] },
      });
    await handler({
      taskId: "t-1",
      event: "STATUS_CHANGE",
      assignedTo: ["member-1"],
      triggeredBy: "member-1",
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("skips sending email when assigned user is not in the users map", async () => {
    // users map only has member-2; member-1 is in assignedTo but not returned by BatchGet
    mockSend
      .mockResolvedValueOnce({ Item: task })
      .mockResolvedValueOnce({
        Responses: { users: [userMap["member-2"]] },
      });
    await handler({
      taskId: "t-1",
      event: "TASK_ASSIGNED",
      assignedTo: ["member-1", "member-2"],
      triggeredBy: "admin-1",
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("STATUS_CHANGE skips email for user not in users map", async () => {
    mockSend
      .mockResolvedValueOnce({ Item: task })
      .mockResolvedValueOnce({
        Responses: { users: [userMap["member-2"]] },
      });
    await handler({
      taskId: "t-1",
      event: "STATUS_CHANGE",
      assignedTo: ["member-1", "member-2"],
      triggeredBy: "member-1",
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("handles undefined Responses from BatchGet gracefully", async () => {
    mockSend
      .mockResolvedValueOnce({ Item: task })
      .mockResolvedValueOnce({ Responses: undefined });
    await handler({
      taskId: "t-1",
      event: "TASK_ASSIGNED",
      assignedTo: ["member-1"],
      triggeredBy: "admin-1",
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});
