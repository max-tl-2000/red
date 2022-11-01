/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chalk from 'chalk';
import bunyan from 'bunyan';
import objectFormatter from './object-formatter';
import tryParse from './try-parse';
import nullish from './nullish';
import { toMoment } from './moment-utils';

/**
 * Map of colors by log level
 */
const colorByLevel = {
  error: 'red',
  debug: 'yellow',
  trace: 'white',
  info: 'cyan',
  warn: 'magenta',
  fatal: 'red',
};

const getColorForRecordBasedOnLevel = rec => {
  const levelName = bunyan.nameFromLevel[rec.level];

  return {
    color: colorByLevel[levelName],
    levelName,
  };
};

/**
 * Format a log record based on the subType.
 * If the subtype is not known then it will
 * default to format each key value of the
 * record using
 *
 * ```
 * objectFormatter.format
 * ```
 *
 * @type       {recordFormatter}
 */
const recordFormatter = {
  /**
   * known subtypes formatters
   */
  formatters: {
    i18n: rec => {
      const { color, levelName } = getColorForRecordBasedOnLevel(rec);
      const result = `[${levelName[0]}]: i18n - ${rec.msg}`;

      return chalk[color](result);
    },
    uncaughtException: {
      formatter: rec => `${chalk.red('[Unhandled exception]')}\n  ${chalk.gray(`pid: ${rec.pid}\n  ${objectFormatter.format('error', rec)}`)}\n`,
      handleError: true,
    },
    unhandledRejection: {
      formatter: rec =>
        `${chalk.red('[Unhandled rejection]')}\n  ${chalk.gray(
          `pid: ${rec.pid}\n  ${objectFormatter.format('error', {
            error: rec.reason,
          })}`,
        )}\n`,
      handleError: true,
    },
    AMQP: rec => {
      const { color, levelName } = getColorForRecordBasedOnLevel(rec);
      let result = chalk[color](`[${levelName[0]}]: [AMQP] ${rec.msg}\n`);

      if (!nullish(rec.amqpMessage)) {
        let amqpMessage = typeof rec.amqpMessage === 'string' ? tryParse(rec.amqpMessage, rec.amqpMessage) : rec.amqpMessage;
        if (amqpMessage && amqpMessage.content && amqpMessage.content instanceof Buffer) {
          // convert to chars and remove unprintables
          const bufferChars = amqpMessage.content.toString('ascii');
          const { content, ...rest } = amqpMessage; // eslint-disable-line
          amqpMessage = { content: bufferChars, ...rest };
        }
        result += chalk.gray(objectFormatter.format('amqpMessage', { amqpMessage }));
      }

      return result;
    },
    'access-log': rec => {
      if (rec.msg === 'request start') {
        return `\n${objectFormatter.format('req', rec)}\n`;
      }
      if (rec.msg === 'request finish') {
        return `\n${objectFormatter.format('res', rec)}\n`;
      }

      return rec.msg;
    },
  },

  defaultFormatter({ rec, colorForLevelField, levelName }) {
    const skipFields = ['v', 'level', 'name', 'hostname', 'pid', 'time', 'msg'];
    const timeField = chalk.bold.blue(toMoment(rec.time).format('HH:mm:ss.SSS'));
    const levelFirstLetter = levelName[0];
    const levelField = chalk[colorForLevelField](`[${levelFirstLetter}]:`);

    let formattedParts = [timeField, levelField, `${rec.msg}\n`];

    const fields = Object.keys(rec).reduce((seq, key) => {
      if (skipFields.indexOf(key) === -1) {
        seq.push(`${objectFormatter.format(key, rec)}\n`);
      }
      return seq;
    }, []);

    if (fields.length > 0) {
      formattedParts = formattedParts.concat(fields);
    }

    return formattedParts;
  },

  /**
   * return a default record formatter if one is found in the formatters property.
   * The entries in the formatters property can either be functions or objects
   * like this:
   *
   * ```
   * interface IFormatterField {
   *   formatter: Function,  // the formatter function
   *   handleError: Boolean, // whether this record knows to handle errors
   * }
   * ```
   *
   *
   * @param      {<type>}  rec      The record
   * @return     {IFormatterField}  an object with the formatter fn and whether
   *                                it should handle errors or not

   */
  getFormatter(rec) {
    const formatterField = this.formatters[rec.subType];
    let formatter;
    let handleError;

    if (formatterField) {
      const isObject = typeof formatterField === 'object';

      formatter = isObject ? formatterField.formatter : formatterField;
      handleError = isObject ? !!formatterField.handleError : false;
    }

    return {
      formatter,
      handleError,
    };
  },

  /**
   * format a record based on the `subType` field of the log record.
   * If subtype is not known default to print as human readable
   * all the record keys, except the ones that are not that useful
   * to humans
   *
   * @param      {Object}  rec     The record
   * @return     {Array}   the formatted strings to print to the output
   */
  format(rec) {
    try {
      const { formatter, handleError } = this.getFormatter(rec);
      const { color: colorForLevelField, levelName } = getColorForRecordBasedOnLevel(rec);
      const { name } = rec;
      const nameEntry = chalk.bgCyan(chalk.black(`[${name}]:`));
      const isError = (rec.error || rec.err) && levelName === 'error';

      if (formatter) {
        if (isError && !handleError) {
          return [nameEntry, ...this.defaultFormatter({ rec, colorForLevelField, levelName })];
        }
        return [nameEntry, formatter(rec)];
      }

      return [nameEntry, ...this.defaultFormatter({ rec, colorForLevelField, levelName })];
    } catch (error) {
      console.error('ERROR FORMATTING LOG', error, { rec });
      return [];
    }
  },
};

export default recordFormatter;
