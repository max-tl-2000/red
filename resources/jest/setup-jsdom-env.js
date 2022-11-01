/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// jest don't have a before hook, this is just
// needed so we make data-driven happy
global.before = done => done && done();
global.Plivo = jest.fn();

if (process.env.DISABLE_CONSOLE === 'true') {
  global.oConsole = global.console;
  global.console = { log() {}, info() {}, debug() {}, error() {}, warn() {}, trace() {} };
}
