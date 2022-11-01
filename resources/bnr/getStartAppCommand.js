/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { commonEnvVars, cucumberEnvs } from './common';
import nullish from '../../common/helpers/nullish';

const getExecCommand = args => {
  if (args.watch) {
    return "nodemon --signal SIGHUP --delay 1000ms --ignore 'client/' --ignore 'local_modules' --exec node_modules/.bin/babel-node --extensions '.ts,.js,.json' ";
  }

  return "babel-node --extensions '.ts,.js,.json' ";
};

// helper function to extract common bits from
// the commands that start the servers
const getStartAppCommand = (file, baseEnv) => ({ args }) => {
  if (!args.production) {
    file = path.resolve(file);
  }

  let env = { ...commonEnvVars, NODE_ENV: 'development', ...baseEnv, BABEL_CACHE_PATH: `node_modules/.cache/babel/${baseEnv?.RED_PROCESS_NAME || 'unknown'}` };
  const isProdOrIntegration = args.production || args.integration;
  let executable = isProdOrIntegration ? 'node --require ./enable-ts.js ./common/server/forever.js' : getExecCommand(args);

  if (args.cucumber) {
    env = { ...env, ...cucumberEnvs };
  }

  env.RED_LOGGER_USE_STDOUT = !args.quiet && !isProdOrIntegration;

  if (args.production) {
    env.NODE_ENV = 'production';
  } else if (args.integration) {
    env.NODE_ENV = 'integration';
  }

  if (args.chromeOnly) {
    env.DEV_CHROME_ONLY = true;
  }

  if (args.debug) {
    const port = args.debugPort || 9229;
    // if debug pass the inspect flag
    // this will print a url to the console that
    // can be copied to chrome to debug the apps
    executable = `babel-node --extensions '.ts,.js,.json' --inspect=${port}`;

    if (args.debugBrk) {
      executable += ' --debug-brk'; // will stop on first line of code
    }

    env.DEBUG = true;
  }

  const memCommand = !nullish(args.memLimit) ? ` --max_old_space_size=${args.memLimit} ` : '';
  const maxHTTPHeaderSizeCommand = !nullish(args.maxHTTPHeaderSize) ? ` --max-http-header-size=${args.maxHTTPHeaderSize} ` : '';
  const backgroundCmd = args.background ? ' &' : ''; // just to make sure bnr process finishes after launching the command

  return { cmd: `${executable} ${file}${memCommand}${maxHTTPHeaderSizeCommand}${backgroundCmd}`, env };
};

export default getStartAppCommand;
