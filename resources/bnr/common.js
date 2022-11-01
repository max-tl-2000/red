/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { platform } from 'os';
import { joinPaths } from './bnr-helpers';
// Used to determine modules for build, linting
export const ALL_MODULES = ['auth', 'rentapp', 'roommates', 'consumer'];

// Used to determine processes to build, start
export const ALL_SERVICES = ['auth', 'consumer'];

// auth doesn't have cucumber yet, and cucumber
// const CUCUMBER_APPS = fs.readdirSync('./cucumber/apps').filter(entry => !entry.match('.DS_Store'));
export const CUCUMBER_APPS = ['leasing', 'rentapp'];

// flag to check if this is the Red Image Build job
// in that one we execute the tests sequentially
export const runTasksInSequence = process.env.IMAGE_BUILDER === 'true' || process.env.CUCUMBER_CI_JOB === 'true' || process.env.CONTINUOUS_INTEGRATION;

export const mochaTimeout = platform() === 'darwin' ? 720000 : 360000; // in mac I found sometimes I need a bigger timeout

export const commonEnvVars = {
  TZ: 'UTC',
  NODE_PATH: joinPaths(['server/', 'common/']),
};

// env variables to run the apps to execute cucumber locally
export const cucumberEnvs = {
  // disable mobx in case of app started for cucumber
  MOBX_DEVTOOLS: false,
  // disable redux devtools (does not play nicely with cucumber)
  DEVTOOLS: false,
  // hot reload does not play nicely with cucumber either
  SKIP_HOT_RELOAD: true,
  // no knex debug
  KNEX_DEBUG: false,
  // no devtools required
  WP_DEVTOOL: 'none',
};

// env variables needed for cucumber process
export const envForCucumber = {
  // do not use stdout for logs
  RED_LOGGER_USE_STDOUT: false,

  // no knex debug
  KNEX_DEBUG: false,

  // this will set the name of the log file to create
  RED_PROCESS_NAME: 'cucumber',

  // this enable us to require stuff from the root of cucumber
  // and common folders like they were node_modules
  NODE_PATH: joinPaths(['./cucumber', './common']),

  // by default assume with are in development mode
  NODE_ENV: 'development',
};

// env variables for development
export const envForDevelopment = {
  DOMAIN: 'local.env.reva.tech',
};

export const buildDepsTasks = ['npm run gen-sprite', 'npm run gen-demo-routes', 'bnr vendors-dev'];
