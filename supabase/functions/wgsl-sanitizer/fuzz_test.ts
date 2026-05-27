// Fuzzing tests for the wgsl-sanitizer edge function.
// Generates many randomized WGSL variants and asserts:
//   - DANGEROUS variants are ALWAYS blocked (403) with the expected rule firing
//   - SAFE variants are ALWAYS allowed (200) with zero violations
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/wgsl-sanitizer`;

// Deterministic PRNG (mulberry32) so failures are reproducible.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(rand: () => number, arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (rand: () => number, min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min;

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

// ---------- Safe shader generators ----------
const SAFE_BUILDERS: Array<(rand: () => number) => string> = [
  (rand) => {
    const wg = pick(rand, [1, 2, 4, 8, 16, 32, 64]);
    return `
@compute @workgroup_size(${wg})
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let v = f32(gid.x) * ${(rand() * 0.01).toFixed(5)};
  _ = v;
}`;
  },
  (rand) => {
    const x = pick(rand, [1, 2, 4, 8]);
    const y = pick(rand, [1, 2, 4, 8]);
    return `
@compute @workgroup_size(${x}, ${y})
fn cs_main() {
  var i = 0;
  loop {
    if (i > ${randInt(rand, 1, 100)}) { break; }
    i = i + 1;
  }
}`;
  },
  (rand) => `
@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  return vec4<f32>(uv, ${rand().toFixed(3)}, 1.0);
}`,
  (rand) => {
    const n = randInt(rand, 1, 4096);
    return `var<private> buf: array<f32, ${n}>;
@compute @workgroup_size(1) fn cs_main() { _ = buf[0]; }`;
  },
  (rand) => {
    const limit = randInt(rand, 1, 50);
    return `
@compute @workgroup_size(1)
fn cs_main() {
  var i = 0;
  while (i < ${limit}) { i = i + 1; }
}`;
  },
];

// ---------- Dangerous shader generators ----------
type DangerousCase = { shader: string; expectedRule: string };
const DANGEROUS_BUILDERS: Array<(rand: () => number) => DangerousCase> = [
  (rand) => {
    const sp = " ".repeat(randInt(rand, 0, 5));
    return {
      shader: `fn bad${randInt(rand, 0, 9999)}() { while${sp}(${sp}true${sp}) { } }`,
      expectedRule: "INFINITE_WHILE_TRUE",
    };
  },
  (rand) => ({
    shader: `fn bad${randInt(rand, 0, 9999)}() { loop { let x = ${randInt(rand, 1, 9)}; } }`,
    expectedRule: "INFINITE_LOOP_NO_BREAK",
  }),
  (rand) => {
    const size = randInt(rand, 1000, 99999);
    return {
      shader: `@compute @workgroup_size(${size}) fn cs_main${randInt(rand, 0, 999)}() {}`,
      expectedRule: "RUNAWAY_WORKGROUP",
    };
  },
  (rand) => {
    const a = randInt(rand, 100, 999);
    const b = randInt(rand, 100, 999);
    return {
      shader: `@compute @workgroup_size(${a}, ${b}) fn cs_main() {}`,
      expectedRule: "RUNAWAY_WORKGROUP",
    };
  },
  (rand) => {
    const name = `recur${randInt(rand, 0, 9999)}`;
    return {
      shader: `fn ${name}(x: i32) -> i32 { return ${name}(x - 1); }`,
      expectedRule: "RECURSION_HINT",
    };
  },
  (rand) => {
    const size = randInt(rand, 1_000_000, 999_999_999);
    return {
      shader: `var<private> huge${randInt(rand, 0, 999)}: array<f32, ${size}>;`,
      expectedRule: "OVERSIZED_ARRAY",
    };
  },
  (rand) => {
    const lit = randInt(rand, 1, 999);
    return {
      shader: `fn bad${randInt(rand, 0, 9999)}() { while (${lit}) { } }`,
      expectedRule: "WHILE_LITERAL_NONZERO",
    };
  },
];

const NOISE_LINES = [
  "// harmless comment",
  "let _safe = 1.0;",
  "/* block comment */",
  "@group(0) @binding(0) var<storage, read> data: array<f32>;",
  "fn helper(x: f32) -> f32 { return x * 2.0; }",
];

function withNoise(rand: () => number, src: string): string {
  const before = Array.from({ length: randInt(rand, 0, 3) }, () => pick(rand, NOISE_LINES)).join("\n");
  const after = Array.from({ length: randInt(rand, 0, 3) }, () => pick(rand, NOISE_LINES)).join("\n");
  return `${before}\n${src}\n${after}`;
}

const FUZZ_ITERATIONS = 40;
const BASE_SEED = 0xC0FFEE;

Deno.test("FUZZ: safe shader variants are always allowed", async () => {
  const rand = rng(BASE_SEED);
  for (let i = 0; i < FUZZ_ITERATIONS; i++) {
    const builder = pick(rand, SAFE_BUILDERS);
    const shader = withNoise(rand, builder(rand));
    const { status, json } = await callSanitizer({ shader });
    assertEquals(
      status,
      200,
      `iter=${i} expected 200 got ${status} for shader:\n${shader}\nresp=${JSON.stringify(json)}`,
    );
    assertEquals(json.blocked, false, `iter=${i} unexpected block:\n${shader}`);
    assertEquals(
      json.violations.length,
      0,
      `iter=${i} unexpected violations ${JSON.stringify(json.violations)} for:\n${shader}`,
    );
  }
});

Deno.test("FUZZ: dangerous shader variants are always blocked", async () => {
  const rand = rng(BASE_SEED ^ 0xDEADBEEF);
  for (let i = 0; i < FUZZ_ITERATIONS; i++) {
    const builder = pick(rand, DANGEROUS_BUILDERS);
    const { shader: payload, expectedRule } = builder(rand);
    const shader = withNoise(rand, payload);
    const { status, json } = await callSanitizer({ shader });
    assertEquals(
      status,
      403,
      `iter=${i} expected 403 got ${status} for rule=${expectedRule}, shader:\n${shader}\nresp=${JSON.stringify(json)}`,
    );
    assertEquals(json.blocked, true);
    assert(
      Array.isArray(json.violations) && json.violations.length > 0,
      `iter=${i} no violations reported for:\n${shader}`,
    );
    assert(
      json.violations.some((v: any) => v.rule === expectedRule),
      `iter=${i} expected rule ${expectedRule} not found in ${JSON.stringify(json.violations)} for:\n${shader}`,
    );
    assertEquals(json.sanitized, "", `iter=${i} sanitized output should be empty when blocked`);
  }
});

Deno.test("FUZZ: dangerous payloads embedded in larger safe-looking shaders are still blocked", async () => {
  const rand = rng(BASE_SEED ^ 0x12345678);
  for (let i = 0; i < FUZZ_ITERATIONS / 2; i++) {
    const safe = pick(rand, SAFE_BUILDERS)(rand);
    const danger = pick(rand, DANGEROUS_BUILDERS)(rand);
    const shader = `${safe}\n${danger.shader}\n${safe}`;
    const { status, json } = await callSanitizer({ shader });
    assertEquals(
      status,
      403,
      `iter=${i} expected block when dangerous payload mixed in, shader:\n${shader}\nresp=${JSON.stringify(json)}`,
    );
    assert(json.violations.some((v: any) => v.rule === danger.expectedRule));
  }
});
