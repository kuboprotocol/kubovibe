# @kubo/sdk

Public SDK for the **KUBO Quantum Game Engine**. Build retro pixel games,
turn-based RPGs, and shared 3D metaverse rooms with one import.

```ts
import { retro, rpg, metaverse, createRetroGame } from '@kubo/sdk';
```

## Installation (inside a Kubo project)

The SDK is exported from `src/sdk` and lives alongside the engine sources.
External consumers will install it as `@kubo/sdk` once published.

```ts
import { createRetroGame, retro } from '@/sdk';
```

## Retro module

Pixel-perfect 8/16-bit framebuffer renderer.

```ts
const game = createRetroGame({
  canvas: document.querySelector('canvas')!,
  width: 160, height: 144, scale: 4, palette: 'pico8',
  update: (r, dt) => {
    r.clear(0);
    r.text('HELLO KUBO', 10, 10, 7);
    r.flush();
  },
});
// game.stop(); when done
```

Palettes available: `nes`, `gameboy`, `pico8`, `kubo`.

## RPG module

Procedural overworld, turn-based battle, branching dialogue, stackable inventory.

```ts
const game = createRpgGame({ mapWidth: 32, mapHeight: 24 });
const battle = game.startBattleWith(rpg.ENEMY_GOBLIN);
const events = rpg.resolveTurn(battle, { kind: 'attack' });
```

## Metaverse module

Shared 3D rooms over Supabase Realtime presence + broadcast.

```ts
const room = await createMetaverseRoom({
  roomId: 'lobby',
  identity: { id: 'u1', name: 'Alice', color: '#C9941A' },
});
room.onPeers(console.log);
room.onChat(console.log);
room.sendPose({ x: 0, y: 0, z: 5, ry: 0 });
room.sendChat('hi!');
```

## React hooks

```ts
import { useRetroGame, useMetaverseRoom } from '@/sdk/react';
```

## Versioning

`VERSION` is exported as a string constant. The SDK follows semver; the engine
internals may evolve faster but the public surface in `src/sdk/index.ts` is
the stable contract.
