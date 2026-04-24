# Serverless Task Management System

## Overview

A production-grade serverless task management system built on AWS. Teams can create tasks, assign them to members, and receive automatic email notifications on assignment and status changes — with zero servers to manage.

- Tasks created, assigned, and tracked via a secure REST API
- Role-based access control: Admins manage, Members execute
- Automatic SES email notifications on assignment and status changes
- All infrastructure provisioned with Terraform — deploy and tear down in minutes

---

## Architecture

### Full Application Flow

```mermaid
flowchart TD
    DEV([Developer])

    subgraph DEPLOY["Deployment — done once"]
        TF_BACKEND["terraform apply\ninfra/backend/\nCreates S3 state bucket\n+ DynamoDB lock table"]
        TF_MAIN["terraform apply\ninfra/\nCreates all AWS resources"]
        BUILD["npm run build\nbackend/\nesbuild compiles TypeScript\n→ backend/dist/"]
        AMPLIFY_CONNECT["Connect GitHub repo\nto AWS Amplify\nSet VITE_* env vars"]
        AMPLIFY_BUILD["Amplify auto-builds\non every git push\nDeploys to CDN"]
    end

    DEV --> TF_BACKEND --> TF_MAIN
    DEV --> BUILD
    BUILD --> TF_MAIN
    DEV --> AMPLIFY_CONNECT --> AMPLIFY_BUILD

    subgraph SIGNUP["Step 1 — User Signup"]
        S1["User fills signup form\nemail + password + full name\non Amplify hosted UI"]
        S2["Cognito fires\npreSignup Lambda"]
        S3{"Email domain\nallowed?"}
        S4["Signup blocked\nError returned to UI"]
        S5["Cognito sends\n6-digit verification code\nto user's email"]
        S6["User enters code\nin the UI"]
        S7["Cognito confirms user\nfires postConfirmation Lambda"]
        S8["postConfirmation writes\nuser record to DynamoDB\nusers table\nrole=Member, status=ACTIVE"]
    end

    AMPLIFY_BUILD --> S1
    S1 --> S2 --> S3
    S3 -- "❌ not amalitech.com\nor amalitechtraining.org" --> S4
    S3 -- "✅ allowed domain" --> S5 --> S6 --> S7 --> S8

    subgraph PROMOTE["Step 2 — Promote to Admin"]
        P1["Run promote-admin.sh\nscripts/promote-admin.sh user@amalitech.com"]
        P2["Script reads User Pool ID\nfrom terraform output"]
        P3["AWS CLI call:\nadmin-add-user-to-group\ngroup=Admins"]
        P4["Next login JWT includes\ncognito:groups: Admins\nUser has admin permissions"]
    end

    S8 --> P1 --> P2 --> P3 --> P4

    subgraph LOGIN["Step 3 — Login & Token Flow"]
        L1["User logs in\nemail + password"]
        L2["Cognito validates\ncredentials via SRP"]
        L3["Cognito issues 3 tokens\nAccess Token — 1hr\nID Token — 1hr\nRefresh Token — 30 days"]
        L4["Frontend stores tokens\nAmplify SDK handles\nauto-refresh silently"]
    end

    P4 --> L1 --> L2 --> L3 --> L4

    subgraph API_FLOW["Step 4 — Every API Call"]
        A1["Frontend sends\nHTTP request +\nAuthorization: Bearer token"]
        A2["API Gateway\nJWT Authorizer\nverifies token signature\nagainst Cognito public keys"]
        A3{"Token valid?"}
        A4["401 Unauthorized\nreturned to browser"]
        A5["Lambda invoked\nwith verified claims\nin event context"]
        A6["Lambda reads\ncognito:groups claim\nfrom JWT — no extra DB lookup"]
    end

    L4 --> A1 --> A2 --> A3
    A3 -- "❌ expired / tampered" --> A4
    A3 -- "✅ valid" --> A5 --> A6

    subgraph TASKS["Step 5 — Task Operations"]
        T1["Admin: POST /tasks\ncreatTask Lambda\nWrites task to DynamoDB\nstatus=OPEN"]
        T2["Admin: PATCH /tasks/id/assign\nassignTask Lambda\nValidates users are ACTIVE\nPrevents duplicates\nlist_append to assignedTo"]
        T3["Async Lambda invoke\nInvocationType: Event\nFire and forget"]
        T4["notify Lambda\nfetches task + users\nfrom DynamoDB\nvia BatchGetItem"]
        T5["SES sends email\nto each assigned member\nTask assigned notification"]
        T6["Member: PUT /tasks/id\nupdateTask Lambda\nCan only set status\nIN_PROGRESS or DONE"]
        T7["Admin: PUT /tasks/id\nfull update\ntitle + description + status"]
        T8["notify Lambda\nfires STATUS_CHANGE\nemails creator + all members\nexcept who made the change"]
        T9["Admin: DELETE /tasks/id\ndeleteTask Lambda\nSoft delete — sets\nstatus=CLOSED\nrecord preserved in DB"]
    end

    A6 --> T1 --> T2 --> T3 --> T4 --> T5
    A6 --> T6 --> T8
    A6 --> T7 --> T8
    A6 --> T9

    subgraph SES_FIX["Optional — SES Sandbox Workaround"]
        SF1["Run set-notification-email.sh\nuser@amalitech.com personal@gmail.com"]
        SF2["Script checks if\npersonal email is\nSES-verified"]
        SF3["Sends SES verification\nto personal email\nWaits for user to click link"]
        SF4["Looks up userId\nfrom Cognito using\ncorporate email"]
        SF5["Updates email field\nin DynamoDB users table\nto personal address"]
        SF6["All future notifications\ndelivered to Gmail\nbypassing corporate filters"]
    end

    T5 -.->|"corporate email\nblocked by SPF/DKIM"| SF1
    SF1 --> SF2 --> SF3 --> SF4 --> SF5 --> SF6

    subgraph INFRA["AWS Infrastructure — always running"]
        DB_TASKS[("DynamoDB\ntasks table\nPAY_PER_REQUEST\nPITR enabled")]
        DB_USERS[("DynamoDB\nusers table\nPAY_PER_REQUEST\nPITR enabled")]
        S3_STATE[("S3 Bucket\nTerraform state\nEncrypted\nVersioned")]
        CW["CloudWatch Logs\nAPI Gateway access logs\nLambda execution logs\n14 day retention"]
    end

    T1 & T2 & T6 & T7 & T9 --> DB_TASKS
    S8 & SF5 --> DB_USERS
    T4 --> DB_USERS
    TF_MAIN --> S3_STATE
    A2 & A5 --> CW
```

---

### Request Lifecycle Summary

```
Browser → API Gateway (JWT check) → Lambda (RBAC check) → DynamoDB
                                                        ↘ Lambda invoke (async) → SES → Email
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

### Step 16 — Amplify deployment

Frontend deployed to AWS Amplify. Build completes successfully and the live app is accessible at the Amplify URL.

![Amplify Build Success](screenshots/20-amplify-build-success.png)
![Amplify Live App](screenshots/21-amplify-live-app.png)

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
