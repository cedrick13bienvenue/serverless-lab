import {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  internalError,
} from "../response";

describe("response helpers", () => {
  it("ok returns 200 with body", () => {
    const res = ok({ id: 1 });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string)).toEqual({ id: 1 });
  });

  it("created returns 201 with body", () => {
    const res = created({ id: 2 });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body as string)).toEqual({ id: 2 });
  });

  it("badRequest returns 400 with error message", () => {
    const res = badRequest("missing field");
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body as string)).toEqual({ error: "missing field" });
  });

  it("unauthorized returns 401 with default message", () => {
    const res = unauthorized();
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body as string)).toEqual({ error: "Unauthorized" });
  });

  it("unauthorized returns 401 with custom message", () => {
    const res = unauthorized("Token expired");
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body as string)).toEqual({ error: "Token expired" });
  });

  it("forbidden returns 403 with message", () => {
    const res = forbidden("No access");
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body as string)).toEqual({ error: "No access" });
  });

  it("notFound returns 404 with message", () => {
    const res = notFound("Not here");
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body as string)).toEqual({ error: "Not here" });
  });

  it("conflict returns 409 with message", () => {
    const res = conflict("Duplicate");
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body as string)).toEqual({ error: "Duplicate" });
  });

  it("internalError returns 500 with default message", () => {
    const res = internalError();
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body as string)).toEqual({ error: "Internal server error" });
  });

  it("internalError returns 500 with custom message", () => {
    const res = internalError("DB down");
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body as string)).toEqual({ error: "DB down" });
  });

  it("all helpers include CORS headers", () => {
    for (const res of [ok({}), badRequest("x"), forbidden(), notFound(), internalError()]) {
      expect((res as any).headers["Access-Control-Allow-Origin"]).toBe("*");
    }
  });
});
