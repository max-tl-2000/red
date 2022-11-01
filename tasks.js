/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
import { address } from 'ip';
import path from 'path';
import fs from 'fs';
import os from 'os';
import fsExtra from 'fs-extra';
import flatten from 'lodash/flatten';
import { subtle, error, log, ok, warn } from 'clix-logger/logger';
import { mapSeries } from 'bluebird';
import execp from './resources/execp';
import envVal from './common/helpers/env-val';
import getStartAppCommand from './resources/bnr/getStartAppCommand';
import appStartDescriptor from './resources/bnr/appStartDescriptor';
import openDebuggerDescriptor from './resources/bnr/openDebuggerDescriptor';
import compile from './resources/compile';
import { listRunningProcesses, getProcesses } from './resources/reva-ps';
import { wrapInQuotes, getShellExecCommand, toMultiParams } from './resources/bnr/bnr-helpers';
import {
  mochaTimeout,
  commonEnvVars,
  ALL_MODULES,
  ALL_SERVICES,
  envForDevelopment,
  envForCucumber,
  CUCUMBER_APPS,
  runTasksInSequence,
  buildDepsTasks,
} from './resources/bnr/common';
import { expand } from './resources/expand';
import { write } from './common/helpers/xfs';
import { getListWithString } from './common/helpers/list-utils';
import { analyzeFiles } from './resources/webpack/check-webpack-stats';
import { checkImportsInFile } from './resources/checkImportsInFile';
import { cleanOldCache } from './resources/clean-old-cache';

const isCI = envVal('CI', false);
const isDarwin = os.platform() === 'darwin';
const dockerComposeLocalImages = 'docker-compose -p local -f ./docker/docker-compose-local.yml -f ./docker/docker-compose-local-persistence.yml';
const dockerComposeLocalEnv = {
  WEB_PROXY_CONFIG_MOUNT: './nginx:/etc/nginx/conf.d',
  WEB_PROXY_NETWORK_MODE: isDarwin ? 'bridge' : 'host',
};

const getFileCountOfNodeModules = async () => {
  const count = await execp('find node_modules -type f | wc -l');
  return parseFloat(count.trim());
};

const chromeDockerContainer = ({ args }) => {
  let cmdArgs = '';

  if (args.start) {
    const daemon = args.d ? '-d' : '';
    cmdArgs = ` up ${daemon}`;
  }

  if (args.stop) {
    cmdArgs = ' stop';
  }

  return {
    cmd: `docker-compose -p local -f docker/browser-compose.yml ${cmdArgs}`,
    env: {
      LOCAL_IP_ADDRESS: address(),
    },
  };
};

const getDoBuildModule = (pathToConfig = '', { statsFile, watch } = {}) => {
  const profileStr = statsFile ? `--profile --json > ${statsFile}` : '';
  const watchFlag = watch ? '--watch' : '';
  return [
    `echo "building ${pathToConfig} with statsFile ${statsFile}"`,
    `babel-node --extensions '.js,.ts,.json' --max-old-space-size=4096 ./node_modules/webpack/bin/webpack ${watchFlag} --stats-error-details --bail --config ${pathToConfig} ${profileStr}`,
  ];
};

const allTasks = {
  'storage:init': {
    cmd: ['./scripts/create_database.sh', './scripts/migrate_database.sh'],
  },

  'exec-integration-test': {
    cmd: `node --max-old-space-size=8192 ./node_modules/.bin/mocha --require ./babel-register --timeout ${mochaTimeout} --bail --exit`,
    env: {
      NODE_ENV: 'integration',
      RED_PROCESS_NAME: 'integration-test',
      ...commonEnvVars,
    },
  },

  'exec-integration-report': ({ args }) => {
    const testSuite = getListWithString(args.testSuite);

    const getTestPaths = (testSuites = []) => {
      const getLeasingApiTestDirFromSuiteName = (suiteName = '') => suiteName.split('-')[0];

      const testPaths = [];
      for (const suite of testSuites) {
        switch (true) {
          case /^other-servers$/.test(suite):
            testPaths.push('"{rentapp,resexp,roommates,auth}/server/**/__integration__/*-test.js"');
            testPaths.push('"./common/test-helpers/__integration__/*-test.js"');
            break;
          case /^leasing-servers$/.test(suite):
            testPaths.push('"server/**/__integration__/*-test.js"');
            testPaths.push('"server/**/__integration__/**/*-test.js"');
            break;
          case /.*-api$/.test(suite):
            testPaths.push(`"server/api/__integration__/${getLeasingApiTestDirFromSuiteName(suite)}/*-test.js"`);
            break;
          case /^others$/.test(suite):
            testPaths.push('"{.,rentapp,resexp,roommates,auth}/server/**/__integration__/*-test.js"');
            testPaths.push('"./common/test-helpers/__integration__/*-test.js"');
            break;
          default:
            break;
        }
      }

      return testPaths.join(' ');
    };

    const testPaths = getTestPaths(testSuite);
    const integrationTestCmd = 'npm run integration-test-single';
    const runAllTestsCmd = 'npm run integration-report';
    const reporterOptions = '--reporter mocha-multi-reporters --reporter-options configFile=./mochaConfig.json';
    const runTestSuiteCmd = `${integrationTestCmd} -- ${reporterOptions} ${testPaths}`;

    return testSuite && testPaths ? runTestSuiteCmd : runAllTestsCmd;
  },

  buildDepsOnly: () => buildDepsTasks,

  checkImportsExports: {
    task: async () => {
      let allFiles = await expand({
        patterns: [
          // 'server/workers/rms/rmsHandler.js',
          'cucumber/**/*.{js,ts}',
          'server/**/*.{js,ts}',
          'bin/**/*.{js,ts}',
          'common/**/*.{js,ts}',
          'client/**/*.{js,ts}',
          'resources/**/*.{js,ts}',
          'storybook/**/*.{js,ts}',
          'testcafe/**/*.{js,ts}',
          ...ALL_MODULES.map(mod => `${mod}/**/*.{js,ts}`),
        ],
      });

      allFiles = allFiles.filter(f => !f.match(/\bnode_modules\b/)).map(f => path.resolve(f));

      const res = await mapSeries(allFiles, checkImportsInFile);

      const results = res.reduce((acc, arr) => {
        acc = acc.concat(arr);
        return acc;
      }, []);

      if (results.length > 0) {
        results.forEach(result => {
          warn(`>>> ${result.dep} was not found in ${result.module} from ${result.from}`);
        });
        error(`>>> found ${results.length} import${results.length === 1 ? '' : 's'} that cannot be resolved`);
        // TODO: call process.exit(1) here to make it break the build
        return;
      }
      ok('No unresolved imports found');
    },
  },

  lint: async ({ args }) => {
    const allFiles = wrapInQuotes([
      'cucumber/**/*.{js,ts}',
      'server/**/*.{js,ts}',
      'bin/**/*.{js,ts}',
      'common/**/*.{js,ts}',
      '*.{js,ts}',
      'webpack/**/*.{js,ts}',
      'client/**/*.{js,ts}',
      'resources/**/*.{js,ts}',
      'stories/**/*.{js,ts}',
      'storybook/**/*.{js,ts}',
      'testcafe/**/*.{js,ts}',
      ...ALL_MODULES.map(mod => `${mod}/**/*.{js,ts}`),
    ]);

    const { getChangedAssets } = require('./resources/git-helper');

    // paths containing spaces are causing troubles
    // moving to relative paths to make the linting to work again
    let { js: files } = await getChangedAssets({ resolvePaths: false });
    files = wrapInQuotes(files);
    files = isCI ? files : allFiles;

    const env = {};

    if (args.groupByIssue) {
      env.EFF_BY_ISSUE = true;
    }

    if (args.noSource) {
      env.EFF_NO_SOURCE = true;
    }

    let fixCommand = '';

    if (args.fix) {
      fixCommand = '--fix=true';
    }

    return {
      cmd: `babel-node --extensions '.js,.ts,.json' resources/lint-files ${fixCommand} ${files} ${args._.join(' ')}`,
      env,
    };
  },
  'chrome:container:stop': ({ args }) => chromeDockerContainer({ args: { ...args, stop: true } }),
  // start the chrome container
  'chrome:container:start': ({ args }) => chromeDockerContainer({ args: { ...args, start: true } }),

  'consumer:start': getStartAppCommand('./consumer/bin/server.js', {
    CONSUMER_PORT: 4000,
    RED_PROCESS_NAME: 'consumer-server',
  }),

  'auth:start': getStartAppCommand('./auth/bin/server.js', {
    AUTH_PORT: 3500,
    RED_PROCESS_NAME: 'auth-server',
  }),

  'xlsx:check': {
    task: async ({ args }) => {
      const { getAllChangedFiles } = require('./resources/git-helper');
      const files = await getAllChangedFiles({ resolvePaths: false, compareWithHEAD: !!args['compare-head'], targetGitBranch: args['target-git-branch'] });

      if (files.length === 0) {
        ok('No files changed');
        return;
      }

      const isXLSX = f => path.extname(f).toLowerCase() === '.xlsx';

      const { xlsxFiles, noXlsxFiles } = files.reduce(
        (acc, f) => {
          const prop = isXLSX(f) ? 'xlsxFiles' : 'noXlsxFiles';
          acc[prop].push(f);

          return acc;
        },
        { xlsxFiles: [], noXlsxFiles: [] },
      );

      const allFilesAreXLSX = xlsxFiles.length === files.length;
      const noFilesAreXLSX = noXlsxFiles.length === files.length;

      if (!allFilesAreXLSX && !noFilesAreXLSX) {
        subtle('>>> xlsx files modified\n', `\n - ${xlsxFiles.join('\n - ')}`, '\n');
        if (!envVal('IMAGE_BUILDER')) {
          throw new Error('XLSX files should be included on its own separated PR');
        }
      }

      ok('No xlsx files modified');
    },
  },

  'app-start': appStartDescriptor,

  // clean the cucumber result paths
  'clean-cucumber-output': "babel-node --extensions '.ts,.js,.json' cucumber/scripts/clean.js",

  /**
   * create the database for cucumber/testcafe tests
   */
  'cucumber:db:init': ({ args }) => {
    const env = {
      ...envForCucumber,
      DOMAIN: 'local.env.reva.tech',
      RED_LOGGER_USE_STDOUT: true,
      TESTCAFE_ENV: true,
    };

    args.backup && (env.RESTORE_DB_FROM_BACKUP = 'true');

    return {
      cmd: ['rm -rf testcafe/bks', 'mkdir -p testcafe/bks', "babel-node --extensions '.js,.ts,.json' cucumber/scripts/initDB.js"],
      env,
    };
  },

  /**
   * Restore the db using previously created db data backups
   */
  'cucumber:db:restore': () => {
    const env = {
      ...envForCucumber,
      DOMAIN: 'local.env.reva.tech',
      RED_LOGGER_USE_STDOUT: true,
    };

    return {
      cmd: "babel-node --extensions '.js,.ts,.json' cucumber/scripts/restoreDB.js",
      env,
    };
  },
  // execute cucumber js
  cucumberjs: ({ args }) => {
    // the feature files
    let features = ['./cucumber/apps/leasing/features/Availability.feature', ...CUCUMBER_APPS.map(mod => `./cucumber/apps/${mod}/features/`)];

    let pathsToRequire = [...CUCUMBER_APPS.map(mod => `./cucumber/apps/${mod}/step_definitions/`)];

    // this allows you to execute a given set of tests for a given app
    // for example, to run only rentapp cucumber tests will be `./bnr cucumberjs --app=rentapp`
    if (args.app) {
      const matcher = new RegExp(`^./cucumber/apps/${args.app}`);
      features = features.filter(entry => entry.match(matcher));
      pathsToRequire = pathsToRequire.filter(entry => entry.match(matcher));
    }

    features = features.join(' ');

    // we always require the hooks
    pathsToRequire.push('./cucumber/support/hooks.js');

    // we always require the generic steps
    pathsToRequire.unshift('./cucumber/lib/step_definitions/');

    // tell cucumberjs where the support paths will be located
    // toMultiParams will return something like
    // --require=path1 --require=path2
    const supportPaths = toMultiParams(pathsToRequire, 'require', true);

    const env = { ...envForCucumber };

    args.production && (env.NODE_ENV = 'production');
    args.useContainer && (env.SELENIUM_BROWSER = 'CHROME');
    args.useStdOut && (env.RED_LOGGER_USE_STDOUT = true);
    args.local && (env.SELENIUM_DOMAIN = envVal('SELENIUM_DOMAIN', 'localhost'));
    args.local && (env.DOMAIN = envVal('DOMAIN', envForDevelopment.DOMAIN));
    env.RED_LOG_LEVEL = args.quiet ? 'warn' : 'trace';

    args.backup && (env.RESTORE_DB_FROM_BACKUP = 'true');
    args.keepDB && (env.KEEP_DB_AFTER_TESTS = 'true');
    args.noRefreshTenant && (env.DO_NOT_REFRESH_TENANT = 'true');

    const cmd = [];

    cmd.push('bnr clean-cucumber-output');

    const report = args.report ? '-f json:./cucumber/output/cucumber_report.json' : '';
    const failFast = args.noFailFast ? '' : '--fail-fast';

    cmd.push(`node ./node_modules/cucumber/bin/cucumber.js --compiler ts:babel-register-ts --compiler js:@babel/register \
            ${features} ${supportPaths} -S ${failFast} \
            ${report} --tags ~@Ignore ${args._.join(' ')}`);
    // each command returned in an array will be executed as if they were called with `&&`
    // example:
    // return ['command1', 'command2'] will be the same as 'command1 && command2'
    return {
      cmd,
      env,
    };
  },

  // execute cucumber locally
  'cucumber-local': 'bnr cucumberjs --useStdout --local',

  // generate the cucumber report locally
  'cucumber-report-local': 'bnr cucumberjs --report --local',

  // generate the cucumber report for jenkins
  'cucumber-report-test': 'bnr cucumberjs --report --production',

  // check the files follow the convention for filenames (dash-separated)
  'check-files': () => {
    const pathsToInspect = wrapInQuotes([
      ...ALL_MODULES.map(mod => `${mod}/**/*`),
      ...ALL_MODULES.map(mod => `!${mod}/static/libs/**`),
      ...ALL_MODULES.map(mod => `!${mod}/cucumber/output/**`),
    ]);

    const ignoreMatches = toMultiParams([...ALL_MODULES.map(mod => `${mod}/trans/en-US`)], 'ignoreMatch', true /* wrap values in quotes */);

    return `babel-node --extensions '.js,.ts,.json' ./resources/check-filenames ${pathsToInspect} ${ignoreMatches}`;
  },

  // command to run docker-compose
  'docker-compose': {
    cmd: dockerComposeLocalImages,
    env: dockerComposeLocalEnv,
  },

  // command to start the containers
  'containers:up': ({ rawArgs }) => {
    const composeUp = `${dockerComposeLocalImages} up ${rawArgs.join(' ')}`;
    return {
      cmd: composeUp,
      env: dockerComposeLocalEnv,
    };
  },

  // command to stop the containers
  'containers:stop': () => `${dockerComposeLocalImages} stop`,

  // execute both client and server unit-tests
  test: {
    cmd: ['npm run client-unit-test -- -- --forceExit', 'npm run server-unit-test -- -- --forceExit'],
    env: { ...commonEnvVars, NODE_ENV: 'test' },
  },

  // build the apidoc
  'build-apidoc': {
    cmd: ['json-refs resolve server/api/doc/public.json > server/api/swagger.json', 'json-refs resolve server/api/doc/private.json > server/api/private.json'],
    env: { ...commonEnvVars },
  },

  // validate the apidoc
  'validate-apidoc': {
    cmd: [
      'bnr build-apidoc',
      'swagger validate server/api/swagger.json',
      "babel-node --extensions '.js,.ts,.json' --max-old-space-size=4096 bin/validate-apidoc.js --warn-only",
    ],
    env: { ...commonEnvVars, BABEL_DISABLE_CACHE: 1, REVA_MOCK_KNEX: 1 },
  },

  // validate json file
  'lint-json': "babel-node --extensions '.js,.ts,.json' resources/check-json-format.js",

  // autofix a json file
  'lint-json-fix': 'bnr lint-json -f',

  // verify task
  verify: {
    cmd: ({ args }) => {
      let checkXlsxCmd = 'bnr xlsx:check';
      if (args['compare-head']) {
        checkXlsxCmd = `${checkXlsxCmd} --compare-head`;
      }

      const targetGitBranch = args['target-git-branch'];

      if (targetGitBranch) {
        checkXlsxCmd = `${checkXlsxCmd} --target-git-branch ${targetGitBranch}`;
      }

      return [checkXlsxCmd, 'bnr checkImportsExports', 'tsc --noEmit', 'bnr check', 'bnr check-circular-deps', 'bnr test'];
    },
    env: { ...commonEnvVars, BABEL_DISABLE_CACHE: 1 },
  },

  'type:check': () => 'tsc --noEmit',

  csslint: async ({ args }) => {
    const allFiles = wrapInQuotes([
      'client/**/*.scss',
      '!client/**/*mixins.scss',
      ...ALL_MODULES.reduce((acc, mod) => {
        acc.push(`${mod}/client/**/*.scss`, `!${mod}/client/**/*mixins.css`);
        return acc;
      }, []),
    ]);
    const { getChangedAssets } = require('./resources/git-helper');
    let { css: files } = await getChangedAssets({ resolvePaths: false });
    files = wrapInQuotes(files);
    files = isCI ? files : allFiles;

    return `babel-node --extensions '.js,.ts,.json' resources/lint-files ${args.fix ? '--fix' : ''} --type=scss ${files}`;
  },

  autofix: {
    task: async ({ args }) => {
      const { autofixFiles } = require('./resources/autofix');

      const env = {};

      if (args.targetGitBranch) {
        env.TARGET_GIT_BRANCH = args.targetGitBranch;
      }

      if (args.groupByIssue) {
        env.EFF_BY_ISSUE = true;
      }

      if (args.noSource) {
        env.EFF_NO_SOURCE = true;
      }

      await autofixFiles(args, env);
    },
  },

  // check task
  check: {
    cmd: () => {
      const tasks = ['bnr check-files', 'bnr csslint', 'npm run gherkin-lint', 'bnr validate-apidoc'];

      if (runTasksInSequence) {
        // in image builder we just return the
        // tasks so they are executed in sequence
        return tasks;
      }

      return getShellExecCommand(tasks, { bail: true, sortOutput: true });
    },
    env: { ...commonEnvVars },
  },

  'create-dist-folders': {
    cmd: [...ALL_SERVICES.map(mod => `mkdir -p ${mod}/static/dist`)],
  },
  'vendors-dev': {
    cmd: ({ args }) => {
      const env = {};
      if (args.chromeOnly) {
        env.DEV_CHROME_ONLY = true;
      }
      if (args.production) {
        env.NODE_ENV = 'production';
      }
      return {
        cmd: flatten([
          getDoBuildModule('webpack/webpack-config-polyfill.js'),
          getDoBuildModule('webpack/webpack-vendors.js'),
          getDoBuildModule('webpack/webpack-vendors-leasing.js'),
        ]),
        env,
      };
    },
  },
  'components-demo': {
    cmd: () => flatten(getDoBuildModule('webpack/webpack-components-demo.js')),
  },

  'do-build': {
    cmd: () => {
      const statsDir = './.stats';
      let tasks = [
        'mkdir -p ./.stats',
        getDoBuildModule('webpack/webpack-config-polyfill.js', { statsFile: path.join(statsDir, 'polyfill.json') }),
        getDoBuildModule('webpack/webpack-vendors.js', { statsFile: path.join(statsDir, 'vendors.json') }),
        getDoBuildModule('webpack/webpack-vendors-leasing.js', { statsFile: path.join(statsDir, 'vendors-leasing.json') }),
        getDoBuildModule('webpack/webpack-components-demo.js', { statsFile: path.join(statsDir, 'components-demo.json') }), // build components demo
      ];

      const webpackTasks = [
        getDoBuildModule('webpack/webpack-config.js', { statsFile: path.join(statsDir, 'leasing.json') }),
        getDoBuildModule('webpack/webpack-pages.js', { statsFile: path.join(statsDir, 'pages.json') }),
        ...ALL_SERVICES.map(mod => getDoBuildModule(`${mod}/webpack/webpack-config.js`, { statsFile: path.join(statsDir, `${mod}.json`) })),
      ];

      tasks = tasks.concat(webpackTasks);
      const flattenedTasks = flatten(tasks);
      subtle(`doBuild will execute the following cmds: ${flattenedTasks.join('\n')}`);
      return flattenedTasks;
    },
    env: {
      NODE_ENV: 'production',
    },
  },
  'do-build-module': ({ args: { config, production, ...rest } }) => {
    const env = {};

    if (production) {
      env.NODE_ENV = 'production';
    }

    return {
      cmd: flatten(getDoBuildModule(config, rest)),
      env,
    };
  },

  compress: {
    cmd: () => {
      const tasks = ['npm run compress:red', ...ALL_SERVICES.map(mod => `npm run compress:${mod}`)];

      if (runTasksInSequence) {
        // in IMAGE_BUILDER execute the tasks sequentially
        return tasks;
      }

      return getShellExecCommand(tasks, { bail: true, sortOutput: true });
    },
  },

  // this command will prune the old cache folders
  // files not used for 4 days will be automatically removed
  'clean-old-cache': {
    cmd: cleanOldCache,
  },
  'modules-count-check': {
    // a task is just a function that will be executed when invoked from the command like
    // like ./bnr module-count-check
    // it is not expected to return anything. If some async work is needed it can be done using the async/await
    // approach. This is different than the cmd or command keys as those functions are expected to return a command
    // to be executed in the shell. Task functions are not expected to return anything
    task: async () => {
      const count = await getFileCountOfNodeModules();

      // Not sure what is causing the modules to increase so much
      // when using node8, but will investigate and remove the junk
      // after the upgrade
      const AVERAGE_MODULE_COUNT = 175000; // newer versions have more files

      if (count > AVERAGE_MODULE_COUNT) {
        error(`================================================================================
               Current count of files in node modules (${count}) exceed the expected count of (${AVERAGE_MODULE_COUNT})...
               Please review the dependencies to check why the number have increased so much
               ================================================================================`);
        process.exit(2); // eslint-disable-line
      } else {
        subtle(`node_modules has ${count} files which is below the ${AVERAGE_MODULE_COUNT} limit`);
      }
    },
  },
  'check-circular-deps': {
    cmd: () => {
      const dirs = [
        'auth/client/client.js',
        'auth/bin/server.js',
        // 'aws/',
        // 'bin/',
        'client/client.js',
        // 'common/',
        // 'consumer/',
        // 'cucumber/',
        'rentapp/client/client.js',
        // 'resexp/',
        'roommates/client/client.js',
        'server/api/api.js',
        'server/server.js',
        'server/workers/consumer.js',
        // 'resources/custom-components/',
      ];

      return `node --max-old-space-size=4096  ./node_modules/.bin/madge ${dirs.slice(0, 1).join(' ')} --circular --warning --webpack-config ./resources/madge-webpack.js`;
    },
  },

  'install-post-merge-hook': {
    command: 'bash -c "cd $(git rev-parse --show-toplevel)/.git/hooks ; ln -s ../../scripts/hooks/post-merge"',
  },
  'leasing:start': getStartAppCommand('./bin/server.js', {
    NODE_PATH: './server',
    RED_PROCESS_NAME: 'leasing-server',
    PORT: 3000,
    API_PORT: 3030,
  }),
  'api:start': getStartAppCommand('./bin/api.js', {
    NODE_PATH: './server/api',
    RED_PROCESS_NAME: 'api',
    API_PORT: 3030,
  }),
  'decision_api:start': getStartAppCommand('./bin/decision_api.js', {
    NODE_PATH: './server/decision_api',
    RED_PROCESS_NAME: 'decision_api',
    API_PORT: 3070,
  }),
  'export_api:start': getStartAppCommand('./bin/export_api.js', {
    NODE_PATH: './server/export',
    RED_PROCESS_NAME: 'export_api',
    API_PORT: 3080,
  }),
  'worker:start': getStartAppCommand('./bin/worker.js', {
    NODE_PATH: './server/workers',
    RED_PROCESS_NAME: 'workers',
    API_PORT: 3030,
  }),
  'socket:start': getStartAppCommand('./bin/socket.js', {
    NODE_PATH: './server/socket',
    RED_PROCESS_NAME: 'socket',
    API_PORT: 3030,
  }),
  'open:debugger': openDebuggerDescriptor,
  'cache:bust': {
    task: async ({ args }) => {
      // inline require to avoid preloading this module if not needed
      const { bustCache } = require('./resources/cachebust'); // eslint-disable-line
      const manifestGlobs = ['static/dist/*manifest.json', 'auth/static/dist/*manifest.json', 'consumer/static/dist/*manifest.json'];

      await bustCache(manifestGlobs, args);
    },
  },
  'link-modules': ({ args }) => {
    if (!args.move) {
      return 'cd ./red-dist/ && ln -s ../node_modules';
    }

    return 'mv node_modules ./red-dist/';
  },
  'clean-server-dist': 'rm -rf ./red-dist/',
  'compile-server': {
    task: async ({ args }) => {
      const compileArgs = { dryRun: args.dryRun };
      const noCopy = [
        /__integration__/,
        /__tests__/,
        /auth\/client\//,
        /auth\/lib\//,
        /common\/client/,
        /auth\/webpack/,
        /consumer\/webpack/,
        /rentapp\/client/,
        /rentapp\/lib/,
      ];

      await compile('./analytics/**', './red-dist/', {
        ...compileArgs,
        noCopy,
        noTransform: [/static/],
      });
      await compile('./auth/**', './red-dist/', {
        ...compileArgs,
        noCopy,
        noTransform: [/static/],
      });
      await compile('./bin/**', './red-dist/', { ...compileArgs });

      // sass components are needed for PartyExport if they were moved to a common location (which they probably should)
      // then the following line can be removed...
      await compile('./client/sass/**', './red-dist/', {
        ...compileArgs,
        noCopy,
      });
      await compile('./client/view-models/person.js', './red-dist/', {
        ...compileArgs,
        noCopy,
      });

      await compile('./client/helpers/**', './red-dist/', {
        ...compileArgs,
        noCopy,
      });

      await compile('./common/**', './red-dist/', { ...compileArgs, noCopy });
      await compile('./consumer/**', './red-dist/', {
        ...compileArgs,
        noCopy,
        noTransform: [/static/, /fake-payment-pages/],
      });
      await compile('./images/**', './red-dist/', { ...compileArgs });

      await compile('./rentapp/**', './red-dist/', {
        ...compileArgs,
        noCopy,
        noTransform: [/static/],
      });

      await compile('./resident/**', './red-dist/', {
        ...compileArgs,
        noCopy,
        noTransform: [/static/],
      });

      // this file is needed for cucumber
      // TODO: check if this file is needed for app running in production
      await compile('./rentapp/server/workers/screening/__tests__/**', './red-dist/', { ...compileArgs, justCopy: true });
      await compile('./rentapp/server/screening/fadv/__integration__/fixtures/**', './red-dist/', compileArgs);

      await compile('./resources/**', './red-dist/', { ...compileArgs });
      await compile('./roommates/**', './red-dist/', {
        ...compileArgs,
        noCopy,
        noTransform: [/static/],
      });

      await compile('./scripts/**', './red-dist/', {
        ...compileArgs,
        justCopy: true,
      });
      await compile('./server/**', './red-dist/', { ...compileArgs, noCopy });
      await compile('./server/import/__tests__/resources/Inventory.xlsx', './red-dist/', { ...compileArgs, justCopy: true });

      await compile('./trans/**', './red-dist/', {
        ...compileArgs,
        justCopy: true,
      });

      await compile('./static/**', './red-dist/', {
        ...compileArgs,
        justCopy: true,
      });
      await compile('./*', './red-dist/', { ...compileArgs });

      if (args.skipCucumber) {
        await compile('./cucumber/configs/**', './red-dist/', {
          ...compileArgs,
        });
        await compile('./cucumber/config.js', './red-dist/', {
          ...compileArgs,
        });
      } else {
        await compile('./cucumber/**', './red-dist/', { ...compileArgs });
      }

      await execp('mkdir -p ./red-dist/.temp/');
      subtle('Create red-dist/.temp');

      await execp('chmod +x ./red-dist/bnr');
      await execp('chmod +x ./red-dist/scripts/*');
      await execp('chmod +x ./red-dist/*.sh');
      subtle('Added permissions back to executable files');
    },
  },
  'build-server': {
    cmd: ({ args }) => ['./bnr clean-server-dist', `./bnr compile-server ${args.skipCucumber ? '--skipCucumber' : ''}`],
  },
  'check-assets-size': {
    task: ({ args }) => {
      const { checkAssetsSize } = require('./resources/check-assets-size'); // eslint-disable-line
      const manifestGlobs = ['static/dist/*manifest.json', 'auth/static/dist/*manifest.json', 'consumer/static/dist/*manifest.json'];

      checkAssetsSize(manifestGlobs, args);
    },
  },
  'sonar-scanner': {
    cmd: () => {
      const sonarServerUrl = 'https://sonarqube.corp.reva.tech';
      const sonarServerFlag = `-Dsonar.host.url=${sonarServerUrl}`;
      const analysisModeFlag = '-Dsonar.analysis.mode=preview';
      const reporterFlags = '-Dsonar.issuesReport.console.enable=true -Dsonar.issuesReport.html.enable=true';
      return [`node_modules/sonar-scanner/bin/sonar-scanner ${sonarServerFlag} ${reporterFlags} ${analysisModeFlag}`];
    },
  },
  'property-setup-test': ({ rawArgs = '' }) => ({
    cmd: `babel-node --extensions=.ts,.js,.json ./resources/property-setup/property-setup-test ${rawArgs.join(' ')}`,
    env: { TEST_TENANT_PASSWORD: envVal('TEST_TENANT_PASSWORD', '') },
  }),
  'property-setup-diff-test': ({ rawArgs = '' }) => ({
    cmd: `babel-node ./resources/property-setup/property-setup-diff-test ${rawArgs.join(' ')}`,
  }),
  'compose-property-setup-diff-test': ({ args }) => {
    const composeFilePath = 'resources/property-setup/docker/property-setup-sheet-diff-test-compose.yml';
    const testConfigCmd = `docker-compose -f ${composeFilePath} config`;
    const testPullCmd = `docker-compose -f ${composeFilePath} pull`;
    const runTestCmd = `docker-compose -f ${composeFilePath} up --force-recreate --no-color --exit-code-from sheets-diff-test`;
    const testEnv = {
      IGNORE_COL_METADATA: args.ignoreColMetadata ? '--diff_ignore_col_metadata' : '',
      IGNORE_SHEETS: args.ignoreSheets ? args.ignoreSheets : '',
      BASE_LINE_SHEET: args.baseLineSheet,
      SHEET_TO_COMPARE: args.sheetToCompare,
    };

    return {
      cmd: [testConfigCmd, testPullCmd, runTestCmd],
      env: testEnv,
    };
  },
  'google-drive-downloader': {
    cmd: ({ rawArgs }) => `babel-node ./resources/property-setup/google-drive-downloader ${rawArgs.join(' ')}`,
  },
  'shutdown-service': {
    cmd: ({ rawArgs }) => `babel-node ./resources/bin/shutdown-service.js ${rawArgs.join(' ')}`,
  },
  'import-cai-utterances': {
    cmd: ({ rawArgs }) => `babel-node --extensions '.js,.json,.ts' ./resources/bin/cai/import-cai-utterances.js ${rawArgs.join(' ')}`,
  },
  'export-cai-utterances': {
    cmd: ({ rawArgs }) => `babel-node --extensions '.js,.json,.ts' ./resources/bin/cai/export-cai-utterances.js ${rawArgs.join(' ')}`,
  },
};

const killProcessByFile = pathToFile => `pkill -9 -f ${pathToFile}`;

const killSocketCmd = killProcessByFile('./bin/socket.js');
const killWorkerCmd = killProcessByFile('./bin/worker.js');
const killApiCmd = killProcessByFile('./bin/api.js');
const killDecisionApiCmd = killProcessByFile('./bin/decision_api.js');
const killYardiExportCmd = killProcessByFile('./bin/export_api.js');
const killLeasingCmd = killProcessByFile('./bin/server.js');
const killConsumerCmd = killProcessByFile('./consumer/bin/server.js');
const killAuthCmd = killProcessByFile('./auth/bin/server.js');

const stopTasks = {
  'socket:stop': { cmd: () => killSocketCmd },
  'worker:stop': { cmd: () => killWorkerCmd },
  'api:stop': { cmd: () => killApiCmd },
  'decision_api:stop': { cmd: () => killDecisionApiCmd },
  'export_api:stop': { cmd: () => killYardiExportCmd },
  'leasing:stop': { cmd: () => killLeasingCmd },
  'consumer:stop': { cmd: () => killConsumerCmd },
  'auth:stop': { cmd: () => killAuthCmd },
  'reva:stop': {
    cmd: async () => {
      const processes = await getProcesses();
      if (processes.length === 0) return 'echo "No reva processes running"';
      return processes.map(pId => `kill -9 ${pId}`).join(' & ');
    },
  },
  'reva:ps': {
    task: async () => {
      const res = await listRunningProcesses();
      if (res === '') {
        ok('No reva processes running');
        return;
      }
      ok('Found reva processes:\n');
      console.log(res);
    },
  },
  'clean:logs': {
    // task to remove all content from logs files
    // we cannot simply delete them because the logger won't create them again
    task: async () => {
      const logs = await expand({ patterns: ['./logs/**/*.log'] });
      const promises = logs.map(file => write(file, ''));
      await Promise.all(promises);
    },
  },
  'vscode:config': {
    task: async ({ args }) => {
      const targets = [
        {
          dest: './.vscode/launch.json',
          source: './vscode-config/vscode/launch-base.json',
        },
        {
          dest: './.vscode/settings.json',
          source: './vscode-config/vscode/settings-base.json',
        },
      ];

      const existsSync = dest => {
        let exist;
        try {
          exist = fs.statSync(dest);
        } catch (ex) {
          exist = false;
        }
        return exist;
      };

      targets.forEach(({ source, dest }) => {
        subtle(`Copying file ${source} to ${dest}`);
        const fileExists = existsSync(dest);

        if (fileExists && !args.overwrite) {
          warn('File exists, if you want to overwrite pass `--overwrite` flag');
          return;
        }

        if (fileExists) {
          subtle(`overwriting existing file ${dest}`);
        }

        fsExtra.copySync(source, dest, { overwrite: true });
        ok(`File copied: ${source}`);
      });
    },
  },
  'copy-npm-to-static': {
    cmd: () => [
      'rm -rf static/thirdparty',
      'mkdir -p static/thirdparty/reva-replacer/',
      'mkdir -p static/thirdparty/self-serve/',
      'mkdir -p static/thirdparty/website-utils/',
      'cp -rv node_modules/@redisrupt/reva-replacer/build/js/** static/thirdparty/reva-replacer/',
      'cp -rv node_modules/@redisrupt/book-appointment-widget/dist/** static/thirdparty/self-serve/',
      'cp -rv node_modules/@redisrupt/website-utils/dist/** static/thirdparty/website-utils/',
    ],
  },
  'lint-logs': {
    cmd: ({ rawArgs }) => `babel-node --extensions '.js,.json,.ts' common/helpers/logSizeAnalyzer.js ${rawArgs.join(' ')}`,
  },
  clearLogs: {
    task: async () => {
      const files = await expand({ patterns: ['./logs/**/*.log'] });
      files.forEach(async file => {
        await write(file, '');
        console.log('>>> cleared file', file);
      });
    },
  },

  analyzeBundles: {
    task: async ({ args }) => {
      const { patterns, ...rest } = args;
      const modules = await analyzeFiles(patterns, rest);

      log('>>> modules', JSON.stringify(modules, null, 2));
      ok('modules found: ', modules.length);
    },
  },

  checkBundles: {
    task: async () => {
      const patterns = './.stats/*.json';
      const filter = m => path.dirname(m.name).match(/\bserver\b/);
      const mapper = ({ name, id }) => ({ id, name });

      const modules = await analyzeFiles(patterns, { filter, mapper });

      if (modules.length > 0) {
        error('===============================================================');
        error('FAILURE: SERVER SIDE MODULES ARE INCLUDED IN THE CLIENT BUNDLE');
        error('===============================================================');
        error('\n>>> modules >>>\n\n', JSON.stringify(modules, null, 2));
        throw new Error('server side modules are included in the client bundle');
      }
      ok('Good. No server side code in bundle!');
    },
  },

  mergeBranches: {
    task: async ({ args }) => {
      const { mergeBranches } = require('./resources/merge-branches/merge-branches');
      const {
        branchesToMerge: branches,
        commitsToVerify,
        remote,
        ignoreMergeCheckOnBranches,
        featureBranches,
      } = require('./resources/merge-branches/merge-branches.config');
      await mergeBranches({ featureBranches, branches, commitsToVerify, remote, ignoreMergeCheckOnBranches, ...args });
    },
  },
};

module.exports = () => ({
  ...stopTasks,
  ...allTasks,
  'list-tasks': () => log(Object.keys(allTasks).sort().join('\n')),
});
