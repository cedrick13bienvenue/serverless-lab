import { handler } from "../preSignup";
import type { PreSignUpTriggerEvent } from "aws-lambda";

const makeEvent = (email: string): PreSignUpTriggerEvent =>
  ({
    request: { userAttributes: { email } },
  } as unknown as PreSignUpTriggerEvent);

describe("preSignup", () => {
  it("allows @amalitech.com emails", async () => {
    const event = makeEvent("user@amalitech.com");
    await expect(handler(event, {} as any, () => {})).resolves.toMatchObject({
      request: { userAttributes: { email: "user@amalitech.com" } },
    });
  });

  it("allows @amalitechtraining.org emails", async () => {
    const event = makeEvent("user@amalitechtraining.org");
    await expect(handler(event, {} as any, () => {})).resolves.toBeDefined();
  });

  it("blocks gmail.com", async () => {
    const event = makeEvent("hacker@gmail.com");
    await expect(handler(event, {} as any, () => {})).rejects.toThrow(
      /restricted/
    );
  });

  it("blocks empty email", async () => {
    const event = makeEvent("");
    await expect(handler(event, {} as any, () => {})).rejects.toThrow(
      /restricted/
    );
  });

  it("blocks emails with no domain", async () => {
    const event = makeEvent("nodomain");
    await expect(handler(event, {} as any, () => {})).rejects.toThrow(
      /restricted/
    );
  });
});
