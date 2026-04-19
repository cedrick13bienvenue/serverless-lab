import type { PreSignUpTriggerHandler } from "aws-lambda";

const ALLOWED_DOMAINS = ["amalitech.com", "amalitechtraining.org"];

export const handler: PreSignUpTriggerHandler = async (event) => {
  const email = event.request.userAttributes["email"] ?? "";
  const domain = email.split("@")[1]?.toLowerCase();

  if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
    throw new Error(
      `Sign up is restricted to ${ALLOWED_DOMAINS.join(" and ")} email addresses.`
    );
  }

  return event;
};
