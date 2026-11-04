// The time the farmer's input and route search read. Real time while the main loop runs; once the test
// harness stops the loop (__game.stop()) and drives the game with fixed steps, a virtual clock that only
// those steps move, so a double click ("run there") and the route search budget follow the steps and
// never the machine's load: the same steps file gives the same play-through. Owner: integrator.
export const clock = {
  virtual: false,
  ms: 0,
  now() { return this.virtual ? this.ms : performance.now(); },
};
