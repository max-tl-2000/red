/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

module.exports = {
  warn: console.log.bind(console, '[mock logger warn]'),
  trace: console.log.bind(console, '[mock logger trace]'),
  info: console.log.bind(console, '[mock logger info]'),
  debug: console.log.bind(console, '[mock logger debug]'),
  error: console.log.bind(console, '[mock logger error]'),
  fatal: console.log.bind(console, '[mock logger fatal]'),
  time: console.log.bind(console, '[mock logger time]'),
  timeEnd: console.log.bind(console, '[mock logger timeEnd]'),
  child() {
    return this;
  },
};
