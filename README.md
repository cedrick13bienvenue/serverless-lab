# Serverless Task Management System

## Overview

This lab solves a core organizational problem: **how do teams assign, track, and communicate task progress without managing any servers?**

In manual workflows, tasks live in spreadsheets, assignments are sent over Slack, and nobody knows when a colleague updates a status unless they check. This system replaces all of that with a cloud-native, event-driven architecture where:

- Tasks are created, assigned, and tracked via a secure REST API
- The right people are notified automatically at the right moment via email
- Access is enforced by role — admins manage, members execute
- Everything scales to zero when idle — no EC2, no containers, no idle cost

---

## Objectives

- Deploy a serverless REST API using API Gateway HTTP API + Lambda (Node.js 20 / TypeScript)
- Store tasks and users in DynamoDB with proper access patterns
- Authenticate users via Cognito with mandatory email verification and domain allowlisting
- Send automated SES email notifications on task assignment and status changes
- Enforce RBAC: Admins create/assign/close tasks; Members view and update status only
- Host the React frontend on AWS Amplify with Cognito-protected routes
- Provision all infrastructure with Terraform (modular, remote backend)

---

## Tools & Versions

| Tool              | Version / Detail                  |
|-------------------|-----------------------------------|
| Terraform         | >= 1.5.0                          |
| AWS Provider      | ~> 5.0                            |
| Node.js (Lambda)  | 20.x                              |
| TypeScript        | ^5.4.0                            |
| React             | ^18.3.0                           |
| Vite              | ^5.3.0                            |
| AWS Amplify UI    | ^6.0.0                            |
| esbuild           | ^0.20.0 (Lambda bundler)          |
| Jest + ts-jest    | ^29.7.0                           |
| Region            | eu-west-1                         |
| OS (local)        | macOS                             |

---

## Problem This Lab Solves

Organizations managing distributed work face four recurring failures:

- **No single source of truth** — tasks scattered across Slack, email, and spreadsheets
- **No role enforcement** — anyone can accidentally overwrite anything
- **No audit trail** — no record of who changed what status and when
- **Silent updates** — teammates don't know a task changed unless they check

This system addresses all four:
- DynamoDB is the single store — every task mutation goes through the API
- RBAC is enforced in Lambda using Cognito JWT group claims — members physically cannot hit admin endpoints without a 403
- DynamoDB `updatedAt` timestamps and Cognito `createdBy` fields create an implicit audit trail
- SES notifications fire asynchronously on every assignment and status change — the right people are always informed

---

## Architecture

```
BROWSER (React + Amplify UI)
│
│  Cognito-hosted UI or Amplify Authenticator component
│  ├── Signup blocked at Cognito pre-signup Lambda if email not @amalitech.com
│  │   or @amalitechtraining.org
│  ├── Email verification mandatory before first login
│  └── Users placed in Admins or Members Cognito group
│
│  JWT access token in Authorization header
│
▼
API GATEWAY (HTTP API)
├── JWT Authorizer — Cognito User Pool
│   └── Rejects all requests without a valid access token (401)
│
├── POST   /tasks                  → create_task Lambda   (Admin only)
├── GET    /tasks                  → get_tasks Lambda     (Admin: all | Member: assigned)
├── GET    /tasks/{taskId}         → get_task Lambda      (Admin: any | Member: assigned only)
├── PUT    /tasks/{taskId}         → update_task Lambda   (Admin: full | Member: status only)
├── PATCH  /tasks/{taskId}/assign  → assign_task Lambda   (Admin only)
└── DELETE /tasks/{taskId}         → delete_task Lambda   (Admin only — soft close)
                │
                ▼
         LAMBDA (Node.js 20 / TypeScript)
         ├── RBAC checked from JWT claims (cognito:groups)
         ├── DynamoDB operations (tasks table + users table)
         └── Async invoke → notify Lambda → SES emails
                │
                ▼
         DYNAMODB (PAY_PER_REQUEST)
         ├── tasks table  — taskId (PK), status GSI
         └── users table  — userId (PK), email GSI

         SES (email notifications)
         ├── On TASK_ASSIGNED  → email each newly assigned member
         └── On STATUS_CHANGE  → email all assigned members except the one who changed it
```

---

## Project Structure

```
serverless-lab/
├── infra/
│   ├── backend/                 # Stage 1 — S3 + DynamoDB for remote state (local state)
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── modules/
│   │   ├── cognito/             # User pool, groups, pre-signup trigger, app client
│   │   ├── dynamodb/            # tasks + users tables (PAY_PER_REQUEST, PITR on)
│   │   ├── lambda/              # IAM role, all 9 functions packaged from backend/dist
│   │   ├── api-gateway/         # HTTP API, JWT authorizer, routes, Lambda permissions
│   │   └── ses/                 # SES email identity verification
│   ├── main.tf                  # Root module — wires all modules, remote backend
│   ├── variables.tf
│   └── outputs.tf               # API URL, Cognito IDs (copy to frontend .env)
├── backend/                     # Lambda functions (TypeScript)
│   ├── src/
│   │   ├── functions/
│   │   │   ├── auth/
│   │   │   │   ├── preSignup.ts        # Blocks non-approved domains at signup
│   │   │   │   ├── postConfirmation.ts # Syncs verified user into DynamoDB users table
│   │   │   │   └── tests/
│   │   │   │       └── preSignup-test.ts
│   │   │   ├── tasks/
│   │   │   │   ├── createTask.ts       # Admin only
│   │   │   │   ├── getTasks.ts         # Admin: all tasks | Member: assigned only
│   │   │   │   ├── getTask.ts          # Single task, member must be in assignedTo
│   │   │   │   ├── updateTask.ts       # Admin: full update | Member: status only
│   │   │   │   ├── assignTask.ts       # Admin only, prevents duplicates
│   │   │   │   ├── deleteTask.ts       # Soft-close: status → CLOSED
│   │   │   │   └── tests/
│   │   │   │       ├── createTask-test.ts
│   │   │   │       └── updateTask-test.ts
│   │   │   └── notifications/
│   │   │       └── notify.ts           # SES email dispatch (async invocation)
│   │   ├── middleware/
│   │   │   └── rbac.ts                 # JWT claim extraction + role resolution
│   │   ├── types/index.ts              # Task, User, TaskStatus, JwtClaims
│   │   └── utils/
│   │       ├── dynamo.ts               # Shared DynamoDB document client
│   │       └── response.ts             # HTTP response helpers (ok, forbidden, etc.)
│   ├── jest.config.js
│   ├── package.json
│   └── tsconfig.json
├── frontend/                    # React 18 + Vite + Amplify UI
│   ├── src/
│   │   ├── api/client.ts            # Typed fetch wrapper (attaches JWT automatically)
│   │   ├── hooks/useCurrentUser.ts  # Reads Cognito session → userId, email, role
│   │   ├── pages/
│   │   │   ├── TaskListPage.tsx     # Table view; admin sees all, member sees assigned
│   │   │   ├── TaskDetailPage.tsx   # Status update + assign panel (admin only)
│   │   │   └── CreateTaskPage.tsx   # Admin-only new task form
│   │   ├── types/index.ts
│   │   ├── App.tsx                  # Authenticator wrapper + role-aware routing
│   │   └── main.tsx                 # Amplify.configure + ReactDOM.render
│   ├── amplify.yml              # Amplify build spec
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── .env.example
├── screenshoots/                # Evidence screenshots
├── .gitignore
└── README.md
```

---

## API Endpoints

| Method | Path                          | Role         | Description                                      |
|--------|-------------------------------|--------------|--------------------------------------------------|
| POST   | `/tasks`                      | Admin        | Create a new task                                |
| GET    | `/tasks`                      | Admin/Member | Admin: all tasks. Member: assigned only          |
| GET    | `/tasks/{taskId}`             | Admin/Member | Get single task (member must be assigned)        |
| PUT    | `/tasks/{taskId}`             | Admin/Member | Admin: full update. Member: status only          |
| PATCH  | `/tasks/{taskId}/assign`      | Admin        | Assign member(s) to a task                       |
| DELETE | `/tasks/{taskId}`             | Admin        | Soft-close a task (status → CLOSED)              |

All endpoints require a valid Cognito JWT in the `Authorization` header. Requests without a valid token are rejected by the API Gateway JWT authorizer before they reach Lambda.

---

## Security Considerations

- **Domain allowlisting at signup** — Cognito pre-signup Lambda throws an error for any email not ending in `@amalitech.com` or `@amalitechtraining.org`. The user record is never created.
- **Email verification** — `auto_verified_attributes = ["email"]` + `CONFIRM_WITH_CODE` — unverified users cannot authenticate.
- **JWT authorizer** — every API Gateway route uses a Cognito JWT authorizer. No Lambda is ever invoked without a valid token.
- **RBAC in Lambda** — role is read from `cognito:groups` in the JWT payload. Group membership is managed server-side in Cognito — a client cannot forge it. Members physically cannot reach admin-only code paths.
- **Least-privilege IAM** — the Lambda execution role grants only what's needed: DynamoDB CRUD on the two tables, SES `SendEmail`, Cognito read-only for group lookups, and CloudWatch Logs.
- **Soft deletes** — tasks are never hard-deleted. Status is set to `CLOSED`, preserving the audit trail.
- **Duplicate assignment prevention** — `assignTask` checks existing `assignedTo` before appending and returns 409 on overlap.
- **Deactivated user guard** — `assignTask` reads the user record and rejects assignment if `status !== "ACTIVE"`.
- **DynamoDB PITR** — point-in-time recovery enabled on both tables.
- **S3 state encryption** — Terraform remote state stored with server-side encryption and public access fully blocked.

---

## Prerequisites

1. Terraform >= 1.5.0
2. Node.js >= 20 and npm
3. AWS CLI configured with sandbox account credentials (`aws configure`)
4. A verified SES email address

---

## Usage

### Step 1 — Run tests and build Lambda bundle

```bash
cd backend
npm install
npm test
```

![Tests Passing](screenshoots/01-tests-passing.png)

```bash
npm run build
```

---

### Step 3 — Bootstrap the remote backend

```bash
cd ../infra/backend
terraform init
terraform apply
```

Type `yes`.

![Backend Terraform Apply](screenshoots/02-backend-terraform-apply.png)

---

### Step 4 — Deploy all infrastructure

```bash
cd ..
terraform init
terraform apply -var="ses_from_email=your@amalitech.com"
```

Type `yes`. This creates Cognito, DynamoDB, all Lambdas, API Gateway, and SES identity.

![Main Terraform Apply](screenshoots/03-main-terraform-apply.png)

Copy the three output values into `frontend/.env`:

```
api_gateway_url       = "https://xxxxxxxxxx.execute-api.eu-west-1.amazonaws.com"
cognito_user_pool_id  = "eu-west-1_XXXXXXXXX"
cognito_client_id     = "xxxxxxxxxxxxxxxxxxxxxxxxxx"
```

![Terraform Outputs](screenshoots/04-terraform-outputs.png)

---

### Step 5 — Verify resources in AWS Console

Cognito User Pool and groups, DynamoDB tables, Lambda functions, API Gateway routes:

![AWS Resources Overview](screenshoots/05-aws-resources-overview.png)

---

### Step 6 — Verify SES sender email

AWS sends a verification email to your `ses_from_email` address. Click the link in your inbox before proceeding.

![SES Verified Identity](screenshoots/06-ses-verified-identity.png)

---

### Step 7 — Configure and run the frontend

```bash
cd ../frontend
cp .env.example .env
# paste the three terraform output values
npm install
npm run dev
```

---

### Step 8 — Test domain blocking

Try to sign up with `test@gmail.com`. Cognito should block it immediately.

![Signup Blocked](screenshoots/07-signup-blocked.png)

---

### Step 9 — Sign up, verify and log in

Sign up with your `@amalitech.com` email, enter the verification code from your inbox, and log in.

![Email Verification and Login](screenshoots/08-email-verification-login.png)

---

### Step 10 — Promote to Admin

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <USER_POOL_ID> \
  --username your@amalitech.com \
  --group-name Admins
```

Refresh the app — you now see the **+ New Task** button.

![Admin View After Promotion](screenshoots/09-admin-view.png)

---

### Step 11 — Create and assign a task

Create a task then assign it to a member using their Cognito `userId`.

![Create and Assign Task](screenshoots/10-create-assign-task.png)

---

### Step 12 — Assignment email notification

The assigned member receives an email via SES.

![Assignment Email](screenshoots/11-assignment-email.png)

---

### Step 13 — Member RBAC view

Log in as the member. They see only their assigned tasks — no admin controls visible.

![Member View](screenshoots/12-member-view.png)

---

### Step 14 — Member updates status and triggers notification

The member updates the task to `IN_PROGRESS`. All other assigned members receive a status-change email.

![Status Update and Email](screenshoots/13-status-update-email.png)

---

### Step 15 — Deploy frontend to Amplify

Push to GitHub, connect to Amplify, add the three env vars, deploy.

![Amplify Build](screenshoots/14-amplify-build.png)

Once the build completes, open the Amplify-provided URL in your browser.

![Amplify Live](screenshoots/15-amplify-live.png)

---

### Teardown

```bash
# Destroy main infrastructure first
cd infra
terraform destroy -var="ses_from_email=your@amalitech.com"

# Then destroy the backend
cd backend
terraform destroy
```

Always destroy main infra before the backend — the backend holds the state file that tracks what exists.

---

## Running Tests

```bash
cd backend
npm test
```

15 tests across 3 suites:

| Suite | Tests |
|-------|-------|
| `preSignup-test.ts` | Domain allowlist: 2 allowed domains pass, 3 blocked cases |
| `createTask-test.ts` | RBAC enforcement, input validation, response shape |
| `updateTask-test.ts` | Admin/member permissions, 404 on missing task, 403 on unassigned |

---

## Key Design Decisions

**Pre-signup Lambda for domain gating** — Cognito's built-in email allowlist only supports exact addresses, not domains. The pre-signup trigger fires before the user record is created, so a rejected user never appears in the user pool at all — no cleanup required.

**Soft delete instead of hard delete** — `DELETE /tasks/{taskId}` sets status to `CLOSED` rather than calling `DeleteItem`. This preserves the full task history for audit purposes and avoids any need for restore logic if a task was closed by mistake.

**Async Lambda invocation for notifications** — `updateTask` and `assignTask` invoke the `notify` Lambda with `InvocationType: "Event"` (fire-and-forget). The API response returns immediately; email delivery happens in the background. This prevents SES latency from degrading the perceived API response time.

**JWT group claims for RBAC** — instead of a DynamoDB lookup on every request to check the user's role, the role is read from `cognito:groups` in the JWT payload. Group membership is managed server-side in Cognito and cannot be forged by the client. No extra DB read per request.

**esbuild over tsc for Lambda packaging** — esbuild bundles each handler and its imports into a single JS file, reducing cold start time compared to shipping `node_modules`. The `--external:@aws-sdk/*` flag excludes the AWS SDK since it ships with the Lambda runtime.

**PAY_PER_REQUEST billing for DynamoDB** — provisioned capacity requires capacity planning and wastes money when underutilised. PAY_PER_REQUEST scales automatically from 0 to any load and costs nothing when idle — consistent with the serverless cost model of the rest of the stack.

**Single Lambda IAM role** — all functions share one execution role because the policy is already scoped to the minimum permissions needed across all functions. Separate roles per function would add Terraform complexity without a meaningful security improvement at this scale.
