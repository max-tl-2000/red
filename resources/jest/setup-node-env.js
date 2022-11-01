/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// jest in node mode lack the following globals
// adding them here to allow node code to run properly
// check https://github.com/facebook/jest/issues/1597#issuecomment-253003767 for more details
global.Array = Array;
global.Object = Object;
global.String = String;
global.Function = Function;
global.RegExp = RegExp;
global.Math = Math;
global.Number = Number;
global.Date = Date;
global.parseInt = parseInt;

global.__TESTING__ = true;

if (process.env.DISABLE_CONSOLE === 'true') {
  global.oConsole = global.console;
  global.console = { log() {}, info() {}, debug() {}, error() {}, warn() {}, trace() {} };
}
