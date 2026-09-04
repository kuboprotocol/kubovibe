/** Native compilation targets shared by the cloud build runner and the admin panel.
 * Costs are ledger credits: base action cost multiplied by the target multiplier. */
export interface ArchTarget {
  id: string;
  label: string;
  platform: "web" | "ios" | "android" | "macos" | "windows" | "linux";
  multiplier: number;
}

export const ARCH_TARGETS: ArchTarget[] = [
  { id: "web", label: "Web (universal)", platform: "web", multiplier: 1 },
  { id: "ios-arm64", label: "iOS arm64 (device)", platform: "ios", multiplier: 2.5 },
  { id: "ios-simulator-x64", label: "iOS Simulator x64", platform: "ios", multiplier: 1.5 },
  { id: "android-arm64", label: "Android arm64-v8a", platform: "android", multiplier: 2 },
  { id: "android-x64", label: "Android x86_64", platform: "android", multiplier: 1.5 },
  { id: "macos-universal", label: "macOS universal", platform: "macos", multiplier: 2.5 },
  { id: "windows-x64", label: "Windows x64", platform: "windows", multiplier: 2 },
  { id: "linux-x64", label: "Linux x64", platform: "linux", multiplier: 1.5 },
];

const BY_ID = new Map(ARCH_TARGETS.map((t) => [t.id, t]));

export const archLabel = (id: string): string => BY_ID.get(id)?.label ?? id;
export const archMultiplier = (id: string): number => BY_ID.get(id)?.multiplier ?? 1;
export const archPlatform = (id: string): string => BY_ID.get(id)?.platform ?? "web";

/** Base credit cost per action, before the architecture multiplier. */
export const BUILD_ACTION_COSTS = { build: 2, deploy: 4 } as const;

export const estimateBuildCost = (action: keyof typeof BUILD_ACTION_COSTS, arch: string): number =>
  Math.round(BUILD_ACTION_COSTS[action] * archMultiplier(arch) * 100) / 100;
