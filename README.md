# Serverless Task Management System

## Overview

A production-grade serverless task management system built on AWS. Teams can create tasks, assign them to members, and receive automatic email notifications on assignment and status changes — with zero servers to manage.

- Tasks created, assigned, and tracked via a secure REST API
- Role-based access control: Admins manage, Members execute
- Automatic SES email notifications on assignment and status changes
- All infrastructure provisioned with Terraform — deploy and tear down in minutes

---

## Architecture

```
BROWSER (React + Amplify UI)
│
│  Amplify Authenticator (Cognito-backed)
│  ├── Pre-signup Lambda blocks non-approved email domains
│  ├── Email verification required before first login
│  └── Role assigned via Cognito group (Admins / Members)
│
│  JWT access token in Authorization header on every API call
│
▼
API GATEWAY (HTTP API)
├── JWT Authorizer → rejects requests without valid Cognito token (401)
│
├── POST   /tasks                  → create_task Lambda    (Admin only)
├── GET    /tasks                  → get_tasks Lambda      (Admin: all | Member: assigned)
├── GET    /tasks/{taskId}         → get_task Lambda       (Admin: any | Member: assigned)
├── PUT    /tasks/{taskId}         → update_task Lambda    (Admin: full | Member: status only)
├── PATCH  /tasks/{taskId}/assign  → assign_task Lambda    (Admin only)
├── DELETE /tasks/{taskId}         → delete_task Lambda    (Admin only — soft close)
└── GET    /users                  → get_users Lambda      (Admin only)
              │
              ▼
       LAMBDA (Node.js 20 / TypeScript)
       ├── RBAC checked from JWT claims (cognito:groups)
       ├── DynamoDB operations (tasks + users tables)
       └── Async invoke → notify Lambda → SES emails
              │
              ▼
       DYNAMODB (PAY_PER_REQUEST)
       ├── tasks  — taskId (PK)
       └── users  — userId (PK)

       SES (email notifications)
       ├── TASK_ASSIGNED  → email each newly assigned member
       └── STATUS_CHANGE  → email task creator + all assigned members (except who changed it)
```

---

## Project Structure

```
serverless-lab/
├── infra/
│   ├── backend/          # Stage 1 — S3 bucket + DynamoDB table for Terraform remote state
│   └── modules/
│       ├── cognito/      # User pool, groups, pre-signup + postConfirmation triggers
│       ├── dynamodb/     # tasks + users tables (PAY_PER_REQUEST, PITR enabled)
│       ├── lambda/       # IAM role + all 10 Lambda functions
│       ├── api-gateway/  # HTTP API, JWT authorizer, routes, Lambda permissions
│       └── ses/          # SES email identity resource
├── backend/              # Lambda source (TypeScript)
│   └── src/
│       ├── functions/
│       │   ├── auth/
│       │   │   ├── preSignup.ts         # Blocks non-approved domains at signup
│       │   │   └── postConfirmation.ts  # Syncs verified user into DynamoDB users table
│       │   ├── tasks/
│       │   │   ├── createTask.ts
│       │   │   ├── getTasks.ts
│       │   │   ├── getTask.ts
│       │   │   ├── updateTask.ts        # Triggers STATUS_CHANGE notification
│       │   │   ├── assignTask.ts        # Triggers TASK_ASSIGNED notification
│       │   │   └── deleteTask.ts        # Soft-close: status → CLOSED
│       │   ├── notifications/
│       │   │   └── notify.ts            # SES dispatch (async fire-and-forget)
│       │   └── users/
│       │       └── getUsers.ts          # Admin: list all active users
│       ├── middleware/rbac.ts           # JWT claim extraction + group-based role check
│       └── utils/
│           ├── dynamo.ts               # Shared DynamoDB document client
│           └── response.ts             # HTTP response helpers
├── frontend/             # React 18 + Vite + Amplify UI
│   └── src/
│       ├── api/client.ts               # Typed fetch wrapper (attaches JWT automatically)
│       ├── context/ThemeContext.tsx    # Dark mode state (persisted to localStorage)
│       ├── hooks/useCurrentUser.ts     # Reads Cognito session → userId, role
│       └── pages/
│           ├── TaskListPage.tsx        # Task table with status badges + dark mode toggle
│           ├── TaskDetailPage.tsx      # Status update, member assignment, close task
│           └── CreateTaskPage.tsx      # Admin-only new task form
├── scripts/
│   ├── promote-admin.sh               # Promote a user to Admins group
│   └── set-notification-email.sh      # Set where notification emails are delivered
├── screenshots/          # Evidence screenshots
└── README.md
```

---

## Tools & Versions

| Tool             | Version         |
|------------------|-----------------|
| Terraform        | >= 1.5.0        |
| AWS Provider     | ~> 5.0          |
| Node.js (Lambda) | 20.x            |
| TypeScript       | ^5.4.0          |
| React            | ^18.3.0         |
| Vite             | ^5.3.0          |
| Amplify UI       | ^6.0.0          |
| esbuild          | ^0.20.0         |
| Jest + ts-jest   | ^29.7.0         |
| Region           | eu-west-1       |

---

## API Endpoints

| Method | Path                         | Role         | Description                                  |
|--------|------------------------------|--------------|----------------------------------------------|
| POST   | `/tasks`                     | Admin        | Create a new task                            |
| GET    | `/tasks`                     | Admin/Member | Admin: all tasks. Member: assigned only      |
| GET    | `/tasks/{taskId}`            | Admin/Member | Get single task                              |
| PUT    | `/tasks/{taskId}`            | Admin/Member | Admin: full update. Member: status only      |
| PATCH  | `/tasks/{taskId}/assign`     | Admin        | Assign member(s) to a task                   |
| DELETE | `/tasks/{taskId}`            | Admin        | Soft-close task (status → CLOSED)            |
| GET    | `/users`                     | Admin        | List all active users                        |

All endpoints require a valid Cognito JWT in the `Authorization` header.

---

## Deployment Guide

### Prerequisites

- Terraform >= 1.5.0
- Node.js >= 20 and npm
- AWS CLI configured (`aws configure`)
- An `@amalitech.com` or `@amalitechtraining.org` email address

---

### Step 1 — Run tests and build Lambda bundle

```bash
cd backend
npm install
npm test
npm run build
```

Tests must pass with 90%+ coverage across all metrics before deploying.

![Test Coverage](screenshots/01-test-coverage.png)

---

### Step 2 — Bootstrap Terraform remote backend

Creates the S3 bucket and DynamoDB table used to store Terraform state remotely.

```bash
cd infra/backend
terraform init
terraform apply
```

Type `yes`.

![Terraform Backend Apply](screenshots/02-terraform-backend-apply.png)

---

### Step 3 — Deploy all infrastructure

```bash
cd ../infra
terraform init
terraform apply -var="ses_from_email=your@amalitech.com"
```

Type `yes`. This provisions Cognito, DynamoDB, all Lambda functions, API Gateway, and SES identity.

![Terraform Main Apply](screenshots/03-terraform-main-apply.png)

Copy the outputs into `frontend/.env`:

```env
VITE_USER_POOL_ID=<cognito_user_pool_id>
VITE_USER_POOL_CLIENT_ID=<cognito_client_id>
VITE_API_URL=<api_gateway_url>
```

---

### Step 4 — Verify resources in AWS Console

#### API Gateway
![API Gateway Console](screenshots/04-api-gateway-console.png)

#### Cognito User Pool
![Cognito User Pool](screenshots/05-cognito-user-pool.png)

#### DynamoDB Tables
![DynamoDB Tables](screenshots/06-dynamodb-tables.png)

#### Lambda Functions
![Lambda Functions](screenshots/07-lambda-functions.png)

---

### Step 5 — Verify SES sender email

AWS sends a verification link to your `ses_from_email` inbox. Click it before proceeding.

![SES Verified](screenshots/08-ses-verified.png)
![SES Identity Console](screenshots/09-ses-identity-console.png)

---

### Step 6 — Start the frontend

```bash
cd frontend
npm install
npm run dev
```

---

### Step 7 — Sign up and verify email

Sign up with your `@amalitech.com` email. Cognito sends a verification code — enter it to confirm your account.

> **Note:** Signup is blocked for non-approved domains (`@gmail.com`, etc.) by the pre-signup Lambda.

![Cognito Verification Email](screenshots/10-cognito-verification-email.png)

---

### Step 8 — Promote yourself to Admin

After signing in, run the promotion script. It reads the User Pool ID directly from Terraform outputs — no hardcoding needed.

```bash
bash scripts/promote-admin.sh your@amalitech.com
```

Sign out and sign back in for the new group membership to take effect in the JWT token.

![Admin Promoted](screenshots/11-admin-promoted.png)

---

### Step 9 — Admin dashboard

After signing back in as Admin, you see the **+ New Task** button and the full task list.

![Admin Dashboard](screenshots/12-admin-dashboard.png)

---

### Step 10 — Create a task and view the task list

Create a task from the **+ New Task** page. It appears in the task list with status `OPEN`.

![Task List](screenshots/13-task-list.png)

---

### Step 11 — Assign a member to a task

Open a task and use the **Assign Members** checkbox panel to assign one or more members by name.

![Task Detail Assign](screenshots/14-task-detail-assign.png)

---

### Step 12 — Set notification email (SES sandbox workaround)

SES sandbox only delivers to verified email addresses. Run this script to redirect a user's notification emails to a verified personal inbox:

```bash
bash scripts/set-notification-email.sh user@amalitech.com personal@gmail.com
```

The script:
1. Checks if `personal@gmail.com` is already verified in SES
2. If not, sends a verification email and waits for you to click the link
3. Looks up the user's `userId` from Cognito using their login email
4. Updates their DynamoDB record so SES sends notifications there

---

### Step 13 — Assignment notification email

After assigning, the member receives an email notification via SES.

![CloudWatch Notify Logs](screenshots/15-cloudwatch-notify-logs.png)
![Assignment Email](screenshots/16-assignment-email.png)

---

### Step 14 — Status change notification email

When a member updates the task status, the task creator (admin) and all other assigned members receive a notification email.

![Status Update Email](screenshots/17-status-update-email.png)

---

### Step 15 — Task assigned with member name + task closed

Members are displayed by name in the task detail. Admins can close any open task with the **Close Task** button.

![Task Assigned Member Name](screenshots/18-task-assigned-member-name.png)
![Task Closed](screenshots/19-task-closed.png)

---

## Scripts

### `scripts/promote-admin.sh`

Promotes a Cognito user to the Admins group. Reads the User Pool ID from Terraform outputs automatically.

```bash
bash scripts/promote-admin.sh your@amalitech.com
```

### `scripts/set-notification-email.sh`

Updates where SES notification emails are delivered for a user. Handles SES verification automatically.

```bash
bash scripts/set-notification-email.sh <cognito-login-email> <notification-email>
```

**Example:**
```bash
bash scripts/set-notification-email.sh member@amalitech.com member.personal@gmail.com
```

**Why this is needed:** SES sandbox mode only delivers to verified email addresses. Corporate email servers (Exchange/Office 365) also commonly block SES sandbox emails. This script lets you redirect notifications to a personal Gmail that can receive them.

---

## Teardown

Always destroy main infrastructure before the backend — the backend holds the state file.

```bash
# 1. Destroy main infrastructure
cd infra
terraform destroy -var="ses_from_email=your@amalitech.com"

# 2. Destroy the Terraform backend
cd infra/backend
terraform destroy
```

---

## Running Tests

```bash
cd backend
npm test -- --coverage
```

90%+ coverage across statements, branches, functions, and lines.

| Suite                    | What it covers                                              |
|--------------------------|-------------------------------------------------------------|
| `preSignup-test.ts`      | Approved domains pass, non-approved domains throw           |
| `createTask-test.ts`     | RBAC enforcement, input validation, DynamoDB write          |
| `updateTask-test.ts`     | Admin full update, member status-only, 403 on unassigned    |

---

## Security

| Control                        | Implementation                                                        |
|-------------------------------|-----------------------------------------------------------------------|
| Domain allowlisting            | Pre-signup Lambda throws for non-approved email domains               |
| Email verification             | Cognito `CONFIRM_WITH_CODE` — unverified users cannot authenticate    |
| JWT protection                 | API Gateway JWT authorizer rejects all requests without valid token   |
| Role-based access control      | Lambda reads `cognito:groups` from JWT — cannot be forged by client   |
| Deactivated user guard         | `assignTask` rejects assignment if `user.status !== "ACTIVE"`         |
| Duplicate assignment prevention| `assignTask` returns 409 if user already in `assignedTo`              |
| Soft deletes                   | Tasks set to `CLOSED`, never hard-deleted — preserves audit trail     |
| Least-privilege IAM            | Lambda role scoped to exact DynamoDB tables, SES send, CloudWatch     |
| DynamoDB PITR                  | Point-in-time recovery enabled on both tables                         |
| Remote state encryption        | Terraform state in S3 with SSE and public access blocked              |

---

## Key Design Decisions

**Pre-signup Lambda for domain gating** — Cognito's built-in allowlist only supports exact addresses, not domains. The trigger fires before the user record is created — a rejected user never appears in the pool.

**postConfirmation Lambda for user sync** — fires after email verification. Writes `userId`, `email`, `name`, `role`, `status` to DynamoDB. This is the source of truth for the notification system.

**Async Lambda invocation for notifications** — `assignTask` and `updateTask` invoke `notify` with `InvocationType: "Event"` (fire-and-forget). The API responds immediately; email delivery happens in the background.

**JWT group claims for RBAC** — role read from `cognito:groups` in the JWT. No extra DynamoDB read per request. Group membership is managed server-side and cannot be forged.

**esbuild for Lambda packaging** — bundles each handler into a single JS file. `--external:@aws-sdk/*` excludes the AWS SDK (ships with the runtime), keeping bundles small and cold starts fast.

**Soft delete** — `DELETE /tasks/{taskId}` sets status to `CLOSED` rather than `DeleteItem`. Preserves task history and prevents accidental data loss.
