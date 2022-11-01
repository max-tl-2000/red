/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import bunyan from 'bunyan';
import stringify from 'json-stringify-safe';
import { mkdirp } from 'mkdirp';
import RotatingFileStream from 'bunyan-rotating-file-stream';
import isEqual from 'lodash/isEqual';
import cloneDeep from 'lodash/cloneDeep';
import envVal from './env-val';
import { process } from './globals';
import recordFormatter from './record-formatter';
import { obscureObject, handleErrorObject, logCtx, formatLogs } from './logger-utils';
import { addTimeFnsToBunyan } from '../server/enhance-bunyan';
import { now } from './moment-utils';
import { NON_ALPHANUMERIC_CHARACTERS } from '../regex';

const cloudEnv = envVal('CLOUD_ENV', 'UNKNOWN');
const dockerMachineName = envVal('DOCKER_MACHINE_NAME', 'UNKNOWN_MACHINE_NAME');
const forceLogCheck = envVal('FORCE_LOG_CHECK', 'false') === 'true';
const isTestEnv = cloudEnv.startsWith('cucumber') || cloudEnv === 'build' || forceLogCheck;

const syslogHost = envVal('SYSLOG_HOST', '');
let syslogEnabled;
let syslogAddress;
let syslogPort;

const elasticLogHost = envVal('ELASTIC_LOG_HOST', '');
let elasticLogEnabled;
const obscureFields = ['socSecNumber', 'token', 'Token', 'key', 'Key', 'authorization', 'Authorization', 'ssn', 'password'];

const containsAnyObscureFields = rec =>
  rec.socSecNumber || rec.token || rec.Token || rec.key || rec.Key || rec.authorization || rec.Authorization || rec.ssn || rec.password;

if (syslogHost !== '') {
  // For some reason, `bunyan-syslog` opens a server on port `42459`
  // this prevents the migration script to actually exit, so the
  // next script is never executed. This makes the PR to fail.
  //
  // ```
  // - Servers:
  // - 0.0.0.0:42459 (UDP)
  // ```
  //
  // Why is this server open, I really don't know,
  // but I was able to find it using the module
  // [wtfnode](https://www.npmjs.com/package/wtfnode).
  //
  // So now the logs will only be sent to the syslog
  // server when the env variable `SYSLOG_ENABLED`
  // is set to `true`. This is currently only happening
  // when the app is launch in production mode
  // (using `npm start`).
  //
  syslogEnabled = envVal('SYSLOG_ENABLED', false);
  [syslogAddress, syslogPort] = syslogHost.split(':');
}

if (elasticLogHost !== '') {
  elasticLogEnabled = envVal('ELASTIC_LOG_ENABLED', false);
}
const serializeSensitive = (obj, properties = obscureFields) => obscureObject(obj, properties);

const safelyRestoreRec = (rec, replacer) => {
  let replacerError;
  try {
    replacer && replacer(rec);
  } catch (e) {
    console.error('error replacing data in log entry', JSON.stringify(rec, null, 2));
    replacerError = e;
  }
  return replacerError;
};

// formattedRec, if present, is an array of strings that have been formatted to a subtype-specific format
const safelyFormatAndEmit = (formattedRec, origEmitArgs, oldEmit, that) => {
  let ret;
  let logError;
  let replacer;
  const [origRec, ..._rest] = origEmitArgs;

  try {
    // console.log('safely about to format');
    replacer = formatLogs(origRec);
    // console.log('safely back from format');
    if (formattedRec) {
      // console.log('about to log rec')
      console.log(...formattedRec);
      // console.log('back from log rec')
    }
    // // console.log("safelyFormatAndEmit about to oldEmit", { this: that, origEmitArgs })
    ret = oldEmit.apply(that, origEmitArgs);
  } catch (e) {
    // console.log('caught error');
    console.error(e);
    console.error('error preparing log entry', JSON.stringify(origRec, null, 2));
    logError = e;
  }
  return { ret, replacer, logError };
};

const overrideEmit = level => {
  const logLevel = bunyan.levelFromName[level];
  const oldEmit = bunyan.prototype._emit;

  bunyan.prototype._emit = function overrideLevel(origRec, noEmit) {
    if (!origRec) throw new Error('rec was undefined!');
    // delete the parts of ctx that we do not want to log, log everything else
    let { ctx, ...rec } = origRec;
    rec = { ...logCtx(ctx), ...rec };
    if (noEmit || rec.level < logLevel) {
      return '';
    }

    if (rec.sensitiveData) {
      rec.sensitiveData = serializeSensitive(rec.sensitiveData);
    }

    if (containsAnyObscureFields(rec)) rec = serializeSensitive(rec);

    // TODO:
    // serialize sensitive should not depend on the data on the request
    // this should be done by the logger-middleware request serializer
    if (rec.req && rec.req.body) {
      rec.req.body = serializeSensitive(rec.req.body, rec.req.obscureBody);
    }

    rec = handleErrorObject(rec);

    const origObjForTestCompare = isTestEnv ? cloneDeep(rec) : undefined;

    // console.log("Regular emitter about to safely format", { rec, noEmit });
    let { ret, replacer, logError } = safelyFormatAndEmit(null /* nothing to output to stdout */, [rec, noEmit], oldEmit, this);
    const restoreError = safelyRestoreRec(rec, replacer);
    logError = logError || restoreError;
    if (!logError && isTestEnv && !isEqual(rec, origObjForTestCompare)) {
      const msg = `Log record was mutated! Original\n${stringify(origObjForTestCompare, null, 2)} \nMutated \n ${stringify(rec, null, 2)}`;
      console.error(msg);
      logError = new Error(msg);
    }
    if (logError) throw logError;
    return ret;
  };
};

addTimeFnsToBunyan(bunyan);

export const create = (name, useStdOut, src, level) => {
  const dir = 'logs/';
  mkdirp.sync(dir);

  overrideEmit(level);

  if (useStdOut) {
    // override internal bunyan ._emit method
    // to be able to produce human readable logs
    const logLevel = bunyan.levelFromName[level];
    const oldEmit = bunyan.prototype._emit;
    bunyan.prototype._emit = function overrideLevel(origRec, noEmit) {
      let { ctx, ...rec } = origRec;
      rec = { ...logCtx(ctx), ...rec };

      let emitRet;
      if (!noEmit && rec.level >= logLevel) {
        // // console.log("in stdout emit reformatting record")
        const formattedRec = recordFormatter.format(rec, name);

        const origObjForTestCompare = isTestEnv ? cloneDeep(rec) : undefined;
        // console.log("useStdOut about to safelyFormatAndEmit", { formattedRec, noEmit })
        const { ret, replacer, logError: emitErr } = safelyFormatAndEmit(formattedRec, [rec, noEmit], oldEmit, this);
        // console.log("useStdOut back from safelyFormatAndEmit", { formattedRec, noEmit })
        emitRet = ret;
        const restoreError = safelyRestoreRec(rec, replacer);
        // console.log("useStdOut back from safelyRestore", { formattedRec, noEmit })
        let logError = emitErr || restoreError;
        if (!logError && isTestEnv && !isEqual(rec, origObjForTestCompare)) {
          const msg = `Log record was mutated! Original\n${stringify(origObjForTestCompare, null, 2)} \nMutated \n ${stringify(rec, null, 2)}`;
          console.error(msg);
          logError = new Error(msg);
        }
        // console.log("useStdOut about to return", { emitRet, logError })
        if (logError) throw logError;
      }
      return emitRet;
    };
  }

  const getEsLogger = (Logger, esHost) =>
    new Logger({
      // switching to env variable to avoid to depend on a given config module
      // since this file is also loaded from the other services
      indexPattern: envVal('ELASTIC_LOG_PATTERN', `[logstash-${process.env.CLOUD_ENV}-]YYYY.MM.DD`),
      type: 'logs',
      host: esHost,
    });

  const onStreamError = (err, stream, msg) => {
    stream.write(`[${now().toJSON()}] ${msg}: ${err.stack || '[NO STACK PROVIDED]'}\n`);
  };

  const getStreams = () => {
    const logKeepDays = envVal('RED_LOG_KEEP_DAYS', 3);
    const isPR = envVal('isPR', false);
    const shouldZipLogFiles = !isPR;
    const streams = [];
    const fileStream = new RotatingFileStream({
      path: `${dir}${name}.log`,
      period: '1d',
      totalFiles: logKeepDays,
      gzip: shouldZipLogFiles,
    });

    const { createStream } = require('rotating-file-stream');
    const streamerLoggerConfig = {
      size: '3M',
      interval: '7d',
      maxFiles: 4,
      maxSize: '3M',
    };
    const rfsLogger = createStream(`./logs/${name}-rfs-errors.log`, streamerLoggerConfig);

    fileStream.on('error', err => onStreamError(err, rfsLogger, 'RotatingFileStream logging stream error'));

    streams.push({ stream: fileStream });

    if (syslogEnabled) {
      const bsyslog = require('bunyan-syslog'); // eslint-disable-line global-require
      streams.push({
        type: 'raw',
        stream: bsyslog.createBunyanStream({
          type: 'udp',
          facility: bsyslog.local0,
          host: syslogAddress,
          port: parseInt(syslogPort, 10),
        }),
      });
    }

    if (elasticLogEnabled) {
      // it is better to do a lazy require of bunyan-elasticsearch,
      // to avoid any code to be autoexecuted when it is not needed
      const ElasticsearchLogger = require('bunyan-elasticsearch');

      const loggerErrorMsg = 'Elasticsearch logging stream error';
      const esStream = getEsLogger(ElasticsearchLogger, elasticLogHost);
      const stream = createStream(`./logs/${name}-bes-errors.log`, streamerLoggerConfig);
      esStream.on('error', err => onStreamError(err, stream, loggerErrorMsg));

      const backupEsLogHost = envVal('BACKUP_ELASTIC_LOG_HOST', '');
      if (backupEsLogHost) {
        const backupEsStream = getEsLogger(ElasticsearchLogger, backupEsLogHost);
        const backupBesErrorsStream = createStream(`./logs/${name}-backup-bes-errors.log`, streamerLoggerConfig);
        backupEsStream.on('error', err => onStreamError(err, backupBesErrorsStream, loggerErrorMsg));

        streams.push({ stream: backupEsStream });
      }

      streams.push({
        stream: esStream,
      });
    }

    return streams;
  };

  return bunyan.createLogger({
    name,
    level,
    src,
    serializers: { ...bunyan.stdSerializers, error: bunyan.stdSerializers.err, e: bunyan.stdSerializers.err },
    streams: getStreams(),
    cloudEnv,
    env: cloudEnv.replace(NON_ALPHANUMERIC_CHARACTERS, ''),
    dockerMachineName,
  });
};

const loggerInstance = create(
  envVal('RED_PROCESS_NAME', 'unknown-process'),
  envVal('RED_LOGGER_USE_STDOUT', true),
  envVal('RED_LOGGER_SRC', process.env.NODE_ENV !== 'production'),
  envVal('RED_LOG_LEVEL', 'trace'),
);

export default loggerInstance;
