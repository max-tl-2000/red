/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import _ from 'lodash'; // eslint-disable-line red/no-lodash
import { success, error, subtle } from 'clix-logger/logger';
import Table from 'easy-table';
import app from './api';
import publicSwagger from './swagger.json';
import privateSwagger from './private.json';

/**
 * print the data in a table format
 * @param  {String} title the title for the table
 * @param  {Array}  data  the data for the table. An array of objects with
 *                        `path` and `method` fields
 * @return {String}       The string representation of the table
 */
function printTable(title, data = []) {
  const t = new Table();

  data
    .sort((a, b) => a.path.localeCompare(b.path))
    .forEach(row => {
      t.cell('Path', row.path);
      t.cell('Method', row.method);
      t.newRow();
    });

  subtle(`${title}\n\n${t.toString()}\n`);
}

/**
 * translate the swagger style paths to express apis
 * - path/{id} ==> path/:id
 * - party/{partyId} ==> party/:partyId
 *
 * @param  {String} path the path for the api to normalize
 * @return {String}      the normalized path
 */
function normalizeSwaggerPath(path) {
  return path.replace(/\{(.+?)\}/g, ':$1');
}

/**
 * returns all the api endpoints registered in the app
 * @return {Array} an array of objects with the following fields
 *                 `path` and `method`
 */
function getEndpointsInApp(theApp) {
  return theApp._router.stack
    .filter(entry => entry.route && entry.route.path && entry.route.path !== '/swagger.json')
    .reduce((seq, entry) => {
      Object.keys(entry.route.methods).forEach(method => {
        seq.push({
          path: entry.route.path,
          method,
        });
      });
      return seq;
    }, []);
}

/**
 * get the endpoints defined in a swagger definition file
 * @return {Array} an array of objects with the following fields
 *                 `path` and `method`
 */
function getEndpointsInSwaggerFile(obj, arr) {
  return Object.keys(obj.paths).reduce((seq, path) => {
    const entry = obj.paths[path];
    Object.keys(entry).forEach(method => {
      seq.push({
        path: normalizeSwaggerPath(path),
        method,
      });
    });
    return seq;
  }, arr);
}

/**
 * get all endpoints defined in the swagger definitions (public and private)
 * @return {Array} an array of objects with the following fields
 *                 `path` and `method`
 */
function getEndpointsInSwagger() {
  return getEndpointsInSwaggerFile(privateSwagger, getEndpointsInSwaggerFile(publicSwagger, []));
}

/**
 * Determines if there is any api endpoint
 * that need documentation or implementation
 *
 */
export default async function validate(warnOnly) {
  const endpointsInSwagger = getEndpointsInSwagger();
  const endpointsInApp = getEndpointsInApp(app);

  const methodsMissingInSwagger = _.differenceWith(endpointsInApp, endpointsInSwagger, (a, b) => a.path === b.path && a.method === b.method);

  const methodsMissingInApp = _.differenceWith(endpointsInSwagger, endpointsInApp, (a, b) => a.path === b.path && a.method === b.method);

  const missingInAppCount = methodsMissingInApp.length > 0;
  const missingInSwaggerCount = methodsMissingInSwagger.length > 0;

  const exitCode = missingInSwaggerCount ? 1 : 0;

  if (exitCode === 0) {
    success('>> swagger documentation in sync with api');
  } else {
    const ErrType = warnOnly ? 'Warning' : 'Error';
    error(`${ErrType}: swagger documentation not synced with api\n`);
  }

  if (missingInSwaggerCount) {
    printTable('>> ==== Methods needing documentation  ====', methodsMissingInSwagger);
  }

  if (missingInAppCount) {
    // this will be print as a warning
    printTable('>> ==== Methods needing implementation ====', methodsMissingInApp);
  }

  return warnOnly ? 0 : exitCode;
}
