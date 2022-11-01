/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { exec } from 'child_process';
import minimist from 'minimist';
import intersection from 'lodash/intersection';
import { readJSON } from '../common/helpers/xfs';
import tryParse from '../common/helpers/try-parse';
import { subtle, ok, error, warn } from './logger';
import { updatePATH } from './npm-bin-path';

/**
 * custom version of execp. This version is needed because
 * `npm ls` exists with non 0 exitCode in case the dependency is missing
 * but also when there is a mismatch in the version of the dependency
 * installed and the one required by the package.json
 *
 * @param      {String}  cmd     The command to execute
 * @return     {Promise} a Promise that will resolve with
 *                       the output of the execution of the command
 */
const execp = cmd =>
  new Promise((resolve, reject) =>
    exec(cmd, (err, stdout) => {
      if (err) {
        // reject(err) won't work as we need
        // to read the result from the execution
        // sadly npm ls will print to stdout but
        // still exit with -1 if there is an invalid dep
        reject({ err, stdout });
        return;
      }
      resolve(stdout);
    }),
  );

/**
 * Helper function to check the dependencies against the
 * locally installed ones. For each entry `npm ls depName` is executed
 * and we compare the version expected with the actually installed
 *
 * This is handy to verify that yarn actually installed the same versions
 * we expect to have as per the package.json
 *
 * @param dependencies {Object} a hash which keys are the names of deps
 *                              and the values are the versions expected
 * @return {Object} the return value has the following shape
 * interface ICheckDependenciesResult {
 *   wrongVersions: Boolean,    // true if there is at least one version mismatch
 *   hasErrors: Boolean,        // true if there is at least one error during the execution
 *   errors: Error[],           // an array of errors
 *   deps: Object,              // A hash which keys are the dependencies and the value are the versions found
 *   versionsMismatch: Object,  // A hash which keys are the dependencies and the value an object with the
 *                                 the following keys:
 *                                 - expected: String // the expected version
 *                                 - found: String    // the found version
 * }
 *
 */
const checkDependencies = async dependencies => {
  const deps = {};
  const versionsMismatch = {};
  const commands = Object.keys(dependencies).map(dep => ({
    depVersion: dependencies[dep],
    dep,
    command: `npm ls ${dep} --depth=0 --json`,
  }));

  const errors = [];

  // using `for` to be able to use await inside the block
  // forEach won't work and reduce seemed like an overkill
  for (let i = 0; i < commands.length; i++) {
    const { command, dep, depVersion } = commands[i];
    try {
      const result = tryParse(await execp(command));
      const version = result.dependencies[dep].version;

      let method = subtle;
      // even if the semver is fullfilled we want to have
      // the exact version of the dependency so
      // we check if it is actually the same version
      if (depVersion !== version) {
        versionsMismatch[dep] = {
          expected: depVersion,
          found: version,
        };
        method = warn;
      } else {
        deps[dep] = version;
      }

      method(dep, 'version:', version, 'expected:', depVersion);
    } catch (ex) {
      // npm ls will exit with non 0 if the version installed
      // does not fulfill the semver in the package.json
      // and we need to get json structure printed to stdout
      // so we can read which version was the one that was found
      const res = tryParse(ex.stdout);
      if (res) {
        const version = res.dependencies[dep].version;

        if (res && res.dependencies[dep].invalid) {
          versionsMismatch[dep] = {
            expected: depVersion,
            found: version,
          };

          warn(dep, 'version:', version, 'expected:', depVersion);
        } else {
          // show the error message
          error(ex.err.message);

          // push the error to report it later
          errors.push(ex.err);
        }
      } else {
        // push the error to report it later
        errors.push(ex.err);
      }
    }
  }

  return {
    versionsMismatch,
    wrongVersions: Object.keys(versionsMismatch).length > 0,
    hasErrors: errors.length > 0,
    errors,
    deps,
  };
};

/**
 * function to check the versions of the dependencies
 * this is useful to check if yarn actually installed
 * the right dependencies required in the package.json file
 */
const main = async () => {
  await updatePATH();
  const argv = minimist(process.argv.slice(2));

  const { dependencies, devDependencies } = await readJSON('./package.json');

  // check for duplicates in dependencies and devDependencies is usually bad
  // to have depdencies listed in both groups. If some dependecy is needed in both
  // it should be only listed as dependency
  const duplicates = intersection(Object.keys(dependencies), Object.keys(devDependencies));

  if (duplicates.length > 0) {
    error('duplicates found in dependencies and devDependencies', duplicates);
    process.exit(1); // eslint-disable-line
  } else {
    subtle('no duplicates found!');
  }

  subtle('checking dependencies');
  const depResult = await checkDependencies(dependencies);

  if (argv.json) {
    subtle('dependencies ========');
    console.log(JSON.stringify(depResult, null, 2));
  }

  subtle('checking devDependencies');
  const devDepResult = await checkDependencies(devDependencies);

  if (argv.json) {
    subtle('devDependencies =====');
    console.log(JSON.stringify(devDepResult, null, 2));
  }

  if (depResult.hasErrors) {
    depResult.errors.forEach(err => error(err.message, err.stack));
  }

  if (devDepResult.hasErrors) {
    devDepResult.errors.forEach(err => error(err.message, err.stack));
  }

  if (depResult.hasErrors || devDepResult.hasErrors || devDepResult.wrongVersions || depResult.wrongVersions) {
    error('[check-deps] errors found');
    process.exit(1); // eslint-disable-line
  } else {
    ok('[check-deps] done!');
  }
};

main().catch(err => error('[check-deps]', err));
