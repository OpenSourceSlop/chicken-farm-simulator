// The sign and plate lines of the skills update (SKILLS.md §3, §3.12) — contract data of the design round. Owner: package
// "jobs" (it may reword a line, never move a fact to a guide). Every line is general practice: nothing about controllers,
// winches, scales, sample sizes or helpers is on the closed guide lists (PHASE2.md §6.1, PHASE3.md §5.1). The lines describe
// farm equipment and practice, so they show from the start of a run whatever the farmer's skills; only the build switch
// SKILLS_UPDATE.live puts them on the boards (content-signs-cycle.js boardsForDay calls mergeBoardsSkills).
const g = 'general';
const it = (text, source = g, fromDay) => (fromDay != null ? { text, source, fromDay } : { text, source });

/** board id -> lines added at the end of the board (fromDay: shown from that HUD day). Revised after the review: the sight
 *  tubes instead of test valves, no sample sizes, the bucket emptied after every round, the sensor checked, the stage table. */
export const SKILL_BOARD_ITEMS = {
  'water-supply': [it('Each line’s sight tube shows its water pressure: a column at the drinker plate’s mark gives about the plate’s flow; cup-test only a line that reads off, at its own regulator. Blocked nipples do not show on a tube: watch the meter.')],
  drinker: [
    it('Auto winches keep each line at the day’s figure on this plate; look at the heights when you read the meter.'),
    it('A winch motor that stalls trips its overload and its line stays where it was: winch the line by hand to the plate’s figure and reset the motor.'),
  ],
  'sign-vent': [
    it('The controller’s calculator works the timer from the bird count and weight with this table; set it a little over the table (about 110 %) so the air keeps up as the birds grow through the day.'),
    it('A controller can step the timer up by the birds’ count and weight each morning: check it against this table when you read the controller.'),
    it('After a power blip a controller may start again on its first setting: look at the timer when the power comes back.'),
  ],
  'sign-heat': [
    it('A controller can keep a fan stage table for the birds’ age: it adds tunnel fans as the house goes over its target; for young birds the stages are few and high (the young birds line).', g, 8),
    it('After a power cut or a blip a controller may come back with its stages off: set the fans by hand and switch the stages on again at the fan panel.', g, 8),
  ],
  'sign-brooder': [
    it('The concrete under the litter takes about a day to warm through; in a cold or wet week it takes longer.'),
    it('Auto brooders hold the controller’s sensor at the row: a sensor that reads high leaves the house cold. Compare it with the thermometer beside the controller and check the sensor when the two differ.'),
  ],
  'sign-chicks': [
    it('Two people tipping the boxes get the chicks onto the litter in half the time; weigh the sample box before the first stack is tipped.'),
  ],
  silo: [
    it('Order when the silo holds about two days of feed: the mill brings it the next day if you order before 16:00, else the day after.'),
    it('An automatic order is a message to the mill: look for its confirmation on the gauge.'),
  ],
  'controller-lights': [it('Dawn and dusk dimming over about 20 minutes keeps the birds calm when the lights change.', g, 8)],
  'bird-scale': [
    it('A hand scale with a memory weighs the birds in the frame one after another and keeps every weight for the spread.'),
    it('An automatic platform scale weighs the birds that step on it all day; a fouled platform reads light and counts few birds: clean it and weigh by hand.'),
  ],
  'sign-health': [
    it('A tally bucket counts each dead bird as you pick it up; still empty it at the bin after every round.'),
    it('Walk slowly and look at each bird near you: a bird that does not move away, sits hunched or limps is checked in the hand.', g, 8),
  ],
};

/** The boards with the skills update's lines (no line twice; a board the day does not have is left alone). */
export function mergeBoardsSkills(boards, day) {
  const out = { ...boards };
  for (const [id, items] of Object.entries(SKILL_BOARD_ITEMS)) {
    const b = out[id];
    if (!b) continue;
    const have = new Set((b.items || []).map((x) => x.text));
    const add = items.filter((x) => (x.fromDay == null || day >= x.fromDay) && !have.has(x.text)).map(({ text, source }) => ({ text, source }));
    if (add.length) out[id] = { ...b, items: [...(b.items || []), ...add] };
  }
  return out;
}
