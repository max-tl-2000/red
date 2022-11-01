/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import util from 'util';
import chalk from 'chalk';
import bunyan from 'bunyan';
import nullish from './nullish';
import { formatStack } from './stack-formatter';

/**
 * return a string with a given number of spaces corresponding
 * to the provided indentLevel parameter. If indent is 0, then it
 * returns an empty string
 *
 * @param      {number}          indentLevel  The indent level
 * @return     {string}          an empty string of length equal to indentLevel
 */
const stringByIndent = (indentLevel = 0) => {
  if (indentLevel === 0) return '';
  return new Array(indentLevel + 1).join(' ');
};

/**
 * takes an error like object and extract the stack property
 *
 * @param      {Error}  error   The error like object
 * @return     {string}  the formatted string
 */
const formatError = (error = {}) => {
  const NOLOG = 'NOLOG';
  const NOLOG_MSG = chalk.blue('(redacted error)');

  if (error.message && error.message.startsWith && error.message.startsWith(NOLOG)) {
    return NOLOG_MSG;
  }

  if (!error.stack) return `${chalk.red(`${error.message} [NO STACK PROVIDED]`)}\n`;

  return `${chalk.red(formatStack(error.stack))}\n`;
};

/**
 * objectFormatter is responsible for extracting specific
 * fields out of log record objects, and formatting them
 * in a content-specific manner based on the key name.
 * For example:
 * ```
 * logger.log({err: new Error()}, "This is an error")
 * ```
 * would result in a call to the err formatter, which would
 * extract the Error object from the log record, and then
 * print its stack trace. Errors, HTTP request/response
 * objects, and HTTP headers each have their own formatting
 * styles.
 *
 * Object fields not falling into one of these categories
 * are formatted using util.inspect.
 *
 * @type       {objectFormatter}
 */
const objectFormatter = {
  /**
   * formatters for known types
   */
  formatters: {
    src(key, rec) {
      const entity = rec[key];
      return chalk.gray(`  ${entity.file}:${entity.line}`);
    },
    // the formatter for the error
    err(key, rec) {
      const entity = rec[key];
      return formatError(entity);
    },
    // an alias to handle both err/error cases
    error(key, rec) {
      const entity = rec[key];
      return formatError(entity);
    },
    // the formatter for the header field in a response
    header(key, rec, indentLevel) {
      const entity = rec[key];

      if (!entity) {
        return '';
      }

      return entity
        .split(/\r*\n/)
        .reduce((seq, line) => {
          if (!line.trim()) {
            return seq;
          }
          seq.push(`${stringByIndent(indentLevel)}${line}`);
          return seq;
        }, [])
        .join('\n');
    },
    // the formatter for the headers fields of the request
    headers(key, rec, indentLevel) {
      const printEntity = en =>
        Object.keys(en)
          .map(_key => `${stringByIndent(indentLevel)}${_key}: ${en[_key]}`)
          .join('\n');
      if (!rec[key]) {
        console.trace(`>>> header for ${key} ${rec} does not have a value!`);
      }
      const { authorization, ...entity } = rec[key];
      if (authorization) {
        entity.authorization = `${authorization.substring(0, 20)}...`;
      }
      return printEntity(entity);
    },
    // formatter for responses. Used in the access log
    res(key, rec) {
      const entity = rec[key];
      const levelName = bunyan.nameFromLevel[rec.level];
      const colorMethod = levelName === 'error' ? 'red' : 'yellow';

      let msg = chalk[colorMethod](`⇢⇢ [${rec.reqId}] ⇢⇢\n`);
      msg += chalk.gray(`  status: ${chalk[entity.statusCode >= 400 ? 'red' : 'green'](entity.statusCode)}\n`);
      msg += chalk.gray(`  duration (ms): ${rec.duration}\n`);

      const headers = objectFormatter.format('header', entity, 4);

      if (headers) {
        msg += chalk.gray('  headers: \n');
        msg += chalk.gray(`${headers}\n`);
      }

      msg += chalk[colorMethod]('⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢⇢\n');

      return msg;
    },
    // formatter for requests. Used in the acces log
    req(key, rec) {
      const reqEntity = rec[key];
      let msg = chalk.cyan(`⇠⇠ [${rec.reqId}] ⇠⇠\n`);
      msg += chalk.gray(`  ${reqEntity.method} ${reqEntity.url}\n`);

      msg += chalk.gray('  headers: \n');
      msg += chalk.gray(`${objectFormatter.format('headers', reqEntity, 4)}\n`);

      if (!nullish(reqEntity.body) && Object.keys(reqEntity.body).length > 0) {
        msg += chalk.gray(`  body: \n${util.inspect(reqEntity.body)}\n`);
      }

      msg += chalk.cyan('⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠⇠\n');

      return msg;
    },
  },
  /**
   * return a human readable expression of the value of the key of an object
   * if it does not match one of the known formats it will use util inspect
   * to return a representation of the key of the object
   *
   * @param      {<type>}  key          The key
   * @param      {<type>}  obj          The object
   * @param      {<type>}  indentLevel  The indent level
   * @return     {<type>}  { description_of_the_return_value }
   */
  format(key, obj, indentLevel) {
    const formatter = this.formatters[key];
    if (!formatter) {
      return `${key}: ${util.inspect(obj[key], { maxArrayLength: null })}`;
    }

    return formatter(key, obj, indentLevel);
  },
};

export default objectFormatter;
