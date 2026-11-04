// The first-play introduction (PHASE5.md §6.1): on a player's first level, four short pointer cards, one at a time, each
// anchored to the thing it names (the job card, a sign in view, the time bar, and the flock watch when it first shows);
// Next / Got it moves on, "Skip the introduction" ends it. No lesson, no question: each card only says where something is
// and what it shows. The farm clock stands still while a card shows. Remembered in settings intro.done / intro.seen;
// the guide's "Show the introduction again" clears them. Owner after the design round: package "experience". STUB now:
// it never shows a card (start() answers false).
//
//   const intro = createIntro(ctx, { root })
//   intro.start(reason)     'level-start' | 'watch-shown' | 'again': show the next unseen card for it; true when one shows
//   intro.active            a card is showing (ui.panelKind reads 'paused' while it is)
//   intro.skip()            end the introduction (intro.done)
//   intro.reset()           every card unseen again (the guide's key)
//   intro.update(dt)        every frame (the card follows its anchor)
//   intro.allow(on)         under automation (navigator.webdriver) the cards never start by themselves (every earlier
//                           steps file plays as before); a steps file that tests them calls allow(true) first
//   intro.state()           { active, card, anchorBox, cardBox } (harness)
export const INTRO_CARDS = [
  { id: 'jobs', when: 'level-start', anchor: '.hud-tr--level .ljobs', text: 'Your jobs for today. The top one is the job to do now: the orange marker on the farm shows its place, and the job says which sign holds its facts.' },
  { id: 'signs', when: 'level-start', anchor: 'sign', text: 'Signs stand where you use their facts. Walk up to one and press E to read it; the small line under each fact names its source.' },
  { id: 'time', when: 'level-start', anchor: '.hud-bl .timebar', text: 'The farm clock: pause, 1× and 4×. Next job skips to the next job. Esc opens the menu (saves, settings, how to play); Tab opens the farm map.' },
  { id: 'watch', when: 'watch-shown', anchor: '.fw', text: 'The flock watch measures the birds every farm hour (weight, deaths, comfort, intake) beside this level’s line, and warns in words when a row turns red.' },
];

export function createIntro(ctx) {
  void ctx;
  return {
    stub: true,
    cards: INTRO_CARDS,
    get active() { return false; },
    start() { return false; },
    skip() {},
    reset() {},
    update() {},
    allow() {},
    state: () => ({ active: false, card: null, anchorBox: null, cardBox: null }),
  };
}
