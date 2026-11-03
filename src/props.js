// Phase 2 props and triggers in the house and on the farm: litter (bare concrete -> husk), the
// litter heap and wheelbarrow, chick truck and box stacks, sample table, hand and bird scales,
// water supply and flush valves, the leaking nipple and wet patch, feeder box, light panel, silo
// gauge, office desk, dead bird bin, the new sign boards, the floor thermometer overlay, and the
// foot dip / house door / floor cell triggers. Owner: package "props" (phase2/props).
// STUB: builds nothing yet; the returned shape is the contract.
//
// buildProps(ctx, { house, world }) -> props
//   ctx.farm, ctx.events, ctx.interact are set (main.js); ctx.player and ctx.flock are set right
//   after (the farmer is created after the props, so read them in update, not at build time);
//   ctx.colliders is the farmer's collider array: add / remove your own entries in place.
//   props registers its interactables with ctx.interact.add(...) (ids: PHASE2.md "Interactables"), emits EV.FOOTDIP / EV.HOUSE_ENTER /
//   EV.HOUSE_EXIT / EV.CELL / EV.BOX_PICK / EV.BOX_TIP / EV.LISTEN, and calls ctx.farm.act() for
//   what the farmer does physically ('litter.spread' while the barrow moves, 'chicks.tip' when a
//   stack is emptied).
//   update(dt, env, view)   every frame after the house (view as house.update gets it)
//   setOverlay(name, on)    'floorTemp': the floor thermometer view (unlock floorOverlay)
//   highlight(ids)          orange 'facts' tab on these boards (the current job's signs); [] clears
//   overlay                 { floorTemp: boolean }
//   carrying                null | 'barrow' | 'boxes' | 'dead' | 'scale'   (what the farmer holds)
//   truck                   { state: 'away'|'driving-in'|'parked'|'leaving', arrive(), leave() }
//   stacks                  { left: number } box stacks not yet carried in
//   reset()                 back to the level's prep-day look (bare floor, heap, no truck)
//   serialize() / restore(d)  what the save needs that the farm model does not hold

export function buildProps(ctx, { house, world } = {}) {
  void house; void world;
  const THREE = ctx.THREE;
  const group = new THREE.Group();
  group.name = 'props';
  ctx.scene.add(group);

  const props = {
    group,
    colliders: [],
    overlay: { floorTemp: false },
    carrying: null,
    truck: { state: 'away', arrive() { props.truck.state = 'parked'; }, leave() { props.truck.state = 'away'; } },
    stacks: { left: 0 },
    update(dt, env, view) { void dt; void env; void view; },
    setOverlay(name, on) { if (name in props.overlay) props.overlay[name] = !!on; },
    highlighted: [],
    highlight(ids = []) { props.highlighted = [...ids]; },
    reset() { props.carrying = null; props.truck.state = 'away'; props.stacks.left = 0; },
    serialize() { return { v: 1, carrying: props.carrying, truck: props.truck.state, stacks: props.stacks.left }; },
    restore(d) { if (!d) return; props.carrying = d.carrying ?? null; props.truck.state = d.truck ?? 'away'; props.stacks.left = d.stacks ?? 0; },
  };
  return props;
}
