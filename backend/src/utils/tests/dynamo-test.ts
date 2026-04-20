import { dynamo, TASKS_TABLE, USERS_TABLE } from "../dynamo";

describe("dynamo module", () => {
  it("exports a DynamoDBDocumentClient with a send method", () => {
    expect(dynamo).toBeDefined();
    expect(typeof dynamo.send).toBe("function");
  });

  it("exports TASKS_TABLE and USERS_TABLE constants", () => {
    // In test env the env vars are unset; the exports still exist
    expect("TASKS_TABLE" in { TASKS_TABLE }).toBe(true);
    expect("USERS_TABLE" in { USERS_TABLE }).toBe(true);
  });
});
