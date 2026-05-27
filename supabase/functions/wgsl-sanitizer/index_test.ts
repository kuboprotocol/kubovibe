// Integration tests for the wgsl-sanitizer edge function.
// Validates that dangerous WGSL is blocked (HTTP 403) and that safe shaders pass (HTTP 200).
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/wgsl-sanitizer`;

async function callSanitizer(body: unknown) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json } as { status: number; json: any };
}

const SAFE_FRAGMENT = `
@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  return vec4<f32>(uv, 0.0, 1.0);
}
`;

const SAFE_COMPUTE = `
@compute @workgroup_size(8, 8)
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let v = f32(gid.x) * 0.001;
  _ = v;
}
`;

Deno.test("ALLOWS a safe fragment shader", async () => {
  const { status, json } = await callSanitizer({ shader: SAFE_FRAGMENT, stage: "fragment" });
  assertEquals(status, 200);
  assertEquals(json.blocked, false);
  assertEquals(json.violations.length, 0);
  assertEquals(json.stage, "fragment");
  assert(typeof json.sanitized === "string" && json.sanitized.length > 0);
});

Deno.test("ALLOWS a safe compute shader with bounded workgroup", async () => {
  const { status, json } = await callSanitizer({ shader: SAFE_COMPUTE, stage: "compute" });
  assertEquals(status, 200);
  assertEquals(json.blocked, false);
  assertEquals(json.violations.length, 0);
});

Deno.test("BLOCKS while(true) infinite loop", async () => {
  const shader = `fn bad() { while (true) { } }`;
  const { status, json } = await callSanitizer({ shader });
  assertEquals(status, 403);
  assertEquals(json.blocked, true);
  assert(json.violations.some((v: any) => v.rule === "INFINITE_WHILE_TRUE"));
});

Deno.test("BLOCKS loop {} without break", async () => {
  const shader = `fn bad() { loop { let x = 1; } }`;
  const { status, json } = await callSanitizer({ shader });
  assertEquals(status, 403);
  assert(json.violations.some((v: any) => v.rule === "INFINITE_LOOP_NO_BREAK"));
});

Deno.test("ALLOWS loop {} that contains break", async () => {
  const shader = `
    @compute @workgroup_size(1)
    fn cs_main() {
      var i = 0;
      loop {
        if (i > 10) { break; }
        i = i + 1;
      }
    }
  `;
  const { status, json } = await callSanitizer({ shader, stage: "compute" });
  assertEquals(status, 200);
  assertEquals(json.blocked, false);
});

Deno.test("BLOCKS runaway workgroup size", async () => {
  const shader = `@compute @workgroup_size(9999) fn cs_main() {}`;
  const { status, json } = await callSanitizer({ shader, stage: "compute" });
  assertEquals(status, 403);
  assert(json.violations.some((v: any) => v.rule === "RUNAWAY_WORKGROUP"));
});

Deno.test("BLOCKS self-recursive function", async () => {
  const shader = `fn recur(x: i32) -> i32 { return recur(x - 1); }`;
  const { status, json } = await callSanitizer({ shader });
  assertEquals(status, 403);
  assert(json.violations.some((v: any) => v.rule === "RECURSION_HINT"));
});

Deno.test("BLOCKS oversized fixed-size array", async () => {
  const shader = `var<private> huge: array<f32, 99999999>;`;
  const { status, json } = await callSanitizer({ shader });
  assertEquals(status, 403);
  assert(json.violations.some((v: any) => v.rule === "OVERSIZED_ARRAY"));
});

Deno.test("BLOCKS while(<nonzero literal>)", async () => {
  const shader = `fn bad() { while (1) { } }`;
  const { status, json } = await callSanitizer({ shader });
  assertEquals(status, 403);
  assert(json.violations.some((v: any) => v.rule === "WHILE_LITERAL_NONZERO"));
});

Deno.test("BLOCKS shader exceeding size limit", async () => {
  const shader = "// padding\n".repeat(7000) + "fn ok() {}";
  const { status, json } = await callSanitizer({ shader });
  assertEquals(status, 403);
  assert(json.violations.some((v: any) => v.rule === "SIZE_LIMIT"));
});

Deno.test("REJECTS request without shader field", async () => {
  const { status, json } = await callSanitizer({ stage: "fragment" });
  assertEquals(status, 400);
  assertEquals(json.error, "shader is required");
});

Deno.test("REJECTS empty shader string", async () => {
  const { status, json } = await callSanitizer({ shader: "", stage: "fragment" });
  assertEquals(status, 400);
  assertEquals(json.error, "shader cannot be empty");
});

Deno.test("REJECTS shader as number type", async () => {
  const { status, json } = await callSanitizer({ shader: 12345, stage: "fragment" });
  assertEquals(status, 400);
  assertEquals(json.error, "shader must be a string, received number");
});

Deno.test("REJECTS unknown stage value", async () => {
  const { status, json } = await callSanitizer({ shader: SAFE_FRAGMENT, stage: "geometry" });
  assertEquals(status, 400);
  assert(json.error.includes("stage must be one of"));
});

Deno.test("REJECTS stage as number type", async () => {
  const { status, json } = await callSanitizer({ shader: SAFE_FRAGMENT, stage: 123 });
  assertEquals(status, 400);
  assert(json.error.includes("stage must be one of"));
});

Deno.test("REJECTS non-object body (array)", async () => {
  const { status, json } = await callSanitizer(["not", "an", "object"]);
  assertEquals(status, 400);
  assertEquals(json.error, "Request body must be a JSON object");
});

Deno.test("CORS preflight returns ok", async () => {
  const res = await fetch(ENDPOINT, { method: "OPTIONS" });
  const text = await res.text();
  assertEquals(res.status, 200);
  assertEquals(text, "ok");
});
