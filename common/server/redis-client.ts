/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import redis from 'redis';
import { promisifyAll } from 'bluebird';
import { assert } from '../assert';
import config from '../../server/config';
import loggerModule from '../helpers/logger';
import { IDbContext, IDictionaryHash } from '../types/base-types';

const MAX_RECONNECTION_THRESHOLD = 5000; // milliseconds
const KEY_EXISTS = 1; // redis client returns 1 if key exists
const SUCCESS = 'OK'; // redis client returns 'OK' if set was successful
const EXPIRATION_TIMEOUT_SET = 1; // redis client returns 1 if expiration timeout was set
const DEFAULT_COMMAND_TIMEOUT = 1000; // milliseconds

const logger = loggerModule.child({ subType: 'redisClient' });
const { redis: redisConfig } = config;
const { connection: connectionConfig } = redisConfig;
const secondsInAnHour = 3600;
const secondsInADay = secondsInAnHour * 24;
// values are in seconds
export enum REDIS_KEY_EXPIRATION {
  ONE_HOUR = secondsInAnHour,
  ONE_DAY = secondsInADay,
  ONE_WEEK = secondsInADay * 7,
  THIRTY_DAYS = secondsInADay * 30,
  NINETY_DAYS = secondsInADay * 90,
}

export enum REDIS_KEY_EXPIRATION_UNITS {
  SECONDS = 'EX',
  MILLISECONDS = 'PX',
}

const defaultExpirationTime = REDIS_KEY_EXPIRATION.ONE_DAY;
const defaultExpirationUnit = REDIS_KEY_EXPIRATION_UNITS.SECONDS;

export enum REDIS_SET_STRING_KEY_OPTIONS {
  NONE = 'NONE',
  ONLY_SET_IF_NOT_EXISTS = 'NX',
  ONLY_SET_IF_EXISTS = 'XX',
}

export enum REDIS_LIST_OP_DIRECTION {
  LEFT = 0,
  RIGHT = 1,
}

export interface IRedisListOptions {
  expirationTime?: REDIS_KEY_EXPIRATION;
  lowerLimit?: number;
  upperLimit?: number;
  pushDirection?: REDIS_LIST_OP_DIRECTION;
  popDirection?: REDIS_LIST_OP_DIRECTION;
}

export interface IRedisKeyExpirationOption {
  expirationTime: REDIS_KEY_EXPIRATION;
  expirationUnit?: REDIS_KEY_EXPIRATION_UNITS;
}

export interface IRedisStringKeyOptions {
  keyExpiration: IRedisKeyExpirationOption;
  setOnlyOption?: REDIS_SET_STRING_KEY_OPTIONS;
}

const defaultKeyExpirationOptions: IRedisKeyExpirationOption = {
  expirationTime: defaultExpirationTime,
  expirationUnit: defaultExpirationUnit,
};

const defaultStringKeyOptions: IRedisStringKeyOptions = {
  keyExpiration: defaultKeyExpirationOptions,
  setOnlyOption: REDIS_SET_STRING_KEY_OPTIONS.NONE,
};

const defaultListOptions: IRedisListOptions = {
  expirationTime: defaultKeyExpirationOptions.expirationTime,
  lowerLimit: 0,
  upperLimit: -1, // return all elements in the list
  pushDirection: REDIS_LIST_OP_DIRECTION.RIGHT,
  popDirection: REDIS_LIST_OP_DIRECTION.RIGHT,
};

let redisClient;
promisifyAll(redis.RedisClient.prototype);

const logReconnectionInfo = (options: IDictionaryHash<any>): IDictionaryHash<any> => {
  const {
    attempt: redisConnAttempt,
    error: redisConnError,
    total_retry_time: redisConnRetryTime,
    times_connected: redisConnTimesConnected,
    tryReconnectingIn,
  } = options;

  return {
    redisConnAttempt,
    redisConnError,
    redisConnRetryTime,
    redisConnTimesConnected,
    tryReconnectingIn,
  };
};

/* try to reconnect indefinitely */
const reconnectionStrategy = (options: IDictionaryHash<any>): number => {
  const tryReconnectingIn = Math.min(options.attempt * 100, MAX_RECONNECTION_THRESHOLD);
  logger.info(logReconnectionInfo({ ...options, tryReconnectingIn }), 'Redis client will try to reconnect');
  return tryReconnectingIn;
};

export const getConnection = async (): Promise<any> => {
  if (redisClient) return redisClient;
  redisClient = redis.createClient({ ...connectionConfig, retry_strategy: reconnectionStrategy });

  return new Promise<boolean>((resolve, reject) => {
    redisClient.on('connect', () => {
      logger.info('Connected to redis server');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client is ready to receive commands');
      resolve(redisClient);
    });

    redisClient.on('error', err => {
      logger.error('Error occured connecting to redis server');
      reject(err);
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis client is reconnecting');
    });
  });
};

const executeOnTimeout = async (promise: Promise<any>, errorMsg: string, timeout: number = DEFAULT_COMMAND_TIMEOUT): Promise<any> =>
  Promise.race([
    promise,
    new Promise((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error(errorMsg || `Execution timed out after ${timeout} milliseconds`));
      }, timeout);
    }),
  ]).then(
    val => val,
    err => {
      throw err;
    },
  );

const executeCmd = async (promise: Promise<any>, timeout: number = DEFAULT_COMMAND_TIMEOUT): Promise<any> =>
  await executeOnTimeout(promise, `Command timed out after ${timeout} milliseconds`, timeout);

const cmd = async (command, params) => {
  const redisCache = await executeOnTimeout(getConnection(), `Getting connection timed out after ${DEFAULT_COMMAND_TIMEOUT} milliseconds`);
  return redisCache[command](params);
};

const prefixKey = ({ tenantId } = {} as IDbContext, key: string = ''): string => (tenantId ? `${tenantId}_${key}` : key);

export const getString = async (ctx: IDbContext, key: string = ''): Promise<string | null> => await executeCmd(await cmd('getAsync', [prefixKey(ctx, key)]));

export const setString = async (ctx: IDbContext, key: string, value: string, options = defaultStringKeyOptions): Promise<boolean> => {
  assert(key, 'startDevServerIfNeeded: key must be defined');
  assert(value, 'startDevServerIfNeeded: value must be defined');

  const { keyExpiration = {} as IRedisKeyExpirationOption, setOnlyOption = REDIS_SET_STRING_KEY_OPTIONS.NONE } = options;
  const { expirationTime = REDIS_KEY_EXPIRATION.ONE_DAY, expirationUnit = REDIS_KEY_EXPIRATION_UNITS.SECONDS } = keyExpiration;
  const prefixedKey = prefixKey(ctx, key);

  logger.trace({ ctx, cachedKey: prefixedKey, expirationTime, expirationUnit, setOnlyOption }, 'Setting key in redis cache');

  const result =
    setOnlyOption === REDIS_SET_STRING_KEY_OPTIONS.NONE
      ? await executeCmd(await cmd('setAsync', [prefixedKey, value, expirationUnit, expirationTime]))
      : await executeCmd(await cmd('setAsync', [prefixedKey, value, expirationUnit, expirationTime, setOnlyOption]));

  return (result && result.toUpperCase() === SUCCESS) || false;
};

export const doesKeyExist = async (ctx: IDbContext, key: string = ''): Promise<boolean> =>
  (await executeCmd(await cmd('existsAsync', [prefixKey(ctx, key)]))) === KEY_EXISTS;

export const deleteKey = async (ctx: IDbContext, key: string = ''): Promise<boolean> => (await executeCmd(await cmd('delAsync', [prefixKey(ctx, key)]))) > 0;

export const setKeyExpiration = async (ctx: IDbContext, key: string, expirationTime: number = defaultKeyExpirationOptions.expirationTime): Promise<boolean> => {
  assert(key, 'setKeyExpiration: key must be defined');
  const prefixedKey = prefixKey(ctx, key);

  logger.trace({ ctx, cachedKey: prefixedKey, expirationTime }, 'Setting key to expire');

  return (await executeCmd(await cmd('expireAsync', [prefixedKey, expirationTime]))) === EXPIRATION_TIMEOUT_SET;
};

export const getKeyExpirationTime = async (ctx: IDbContext, key: string = ''): Promise<number> =>
  await executeCmd(await cmd('ttlAsync', [prefixKey(ctx, key)]));

export const isKeyExpirationSet = async (ctx: IDbContext, key: string = ''): Promise<boolean> => (await getKeyExpirationTime(ctx, key)) >= 0;

const setExpiration = async (ctx: IDbContext, key: string, expirationTime: number = defaultKeyExpirationOptions.expirationTime): Promise<void> => {
  !(await isKeyExpirationSet(ctx, key)) && (await setKeyExpiration(ctx, key, expirationTime));
};

export const setHashKey = async (ctx: IDbContext, key: string, hashKeyValuesArray: Array<string>, expirationTime?: number): Promise<boolean> => {
  assert(key, 'setHashKey: key must be defined');
  assert(hashKeyValuesArray && hashKeyValuesArray.length > 1, "setHashKey: hashKeyValuesArray must be defined like ['key 1', 'val 1', 'key 2', 'val 2']");

  const result = await executeCmd(await cmd('hmsetAsync', [prefixKey(ctx, key), hashKeyValuesArray]));
  await setExpiration(ctx, key, expirationTime);

  return (result && result.toUpperCase() === SUCCESS) || false;
};

export const setHashKeyHValue = async (ctx: IDbContext, key: string, hashKey: string, hashKeyValue: string, expirationTime?: number): Promise<number> => {
  assert(key, 'setHashKeyHValue: key must be defined');
  assert(hashKey, 'setHashKeyHValue: hashKey must be defined');
  assert(hashKeyValue, 'setHashKeyHValue: hashKeyValue must be defined');

  const result = await executeCmd(await cmd('hsetAsync', [prefixKey(ctx, key), hashKey, hashKeyValue]));
  await setExpiration(ctx, key, expirationTime);

  return result;
};

export const getHashKey = async (ctx: IDbContext, key: string): Promise<IDictionaryHash<string>> =>
  await executeCmd(await cmd('hgetallAsync', [prefixKey(ctx, key)]));

export const getHashKeyHValue = async (ctx: IDbContext, key, hashKey: string = ''): Promise<string> =>
  await executeCmd(await cmd('hgetAsync', [prefixKey(ctx, key), hashKey]));

export const pushToList = async (
  ctx: IDbContext,
  key: string,
  value: string | Array<string>,
  options: IRedisListOptions = defaultListOptions,
): Promise<number> => {
  assert(key, 'pushToList: key must be defined');
  assert(value, 'pushToList: value must be defined');

  const { expirationTime = defaultListOptions.expirationTime, pushDirection = defaultListOptions.pushDirection } = options;

  const prefixedKey = prefixKey(ctx, key);

  const result =
    pushDirection === REDIS_LIST_OP_DIRECTION.RIGHT
      ? await executeCmd(await cmd('rpushAsync', [prefixedKey, value]))
      : await executeCmd(await cmd('lpushAsync', [prefixedKey, value]));

  await setExpiration(ctx, key, expirationTime);

  return result;
};

export const popList = async (ctx: IDbContext, key: string = '', options: IRedisListOptions = defaultListOptions): Promise<string | null> => {
  const { popDirection = defaultListOptions.popDirection } = options;

  if (popDirection === REDIS_LIST_OP_DIRECTION.RIGHT) return await executeCmd(await cmd('rpopAsync', [prefixKey(ctx, key)]));

  return await executeCmd(await cmd('lpopAsync', [prefixKey(ctx, key)]));
};

export const getListLength = async (ctx: IDbContext, key: string = ''): Promise<number> => await executeCmd(await cmd('llenAsync', [prefixKey(ctx, key)]));

export const getList = async (ctx: IDbContext, key: string = '', options: IRedisListOptions = defaultListOptions): Promise<Array<string>> => {
  const { lowerLimit = defaultListOptions.lowerLimit, upperLimit = defaultListOptions.upperLimit } = options;

  const prefixedKey = prefixKey(ctx, key);

  logger.trace({ ctx, cachedKey: prefixedKey, lowerLimit, upperLimit }, 'Getting list key');

  return await executeCmd(await cmd('lrangeAsync', [prefixedKey, lowerLimit, upperLimit]));
};

export const pushToSet = async (ctx: IDbContext, key: string, value: string | Array<string>, expirationTime?: number): Promise<number> => {
  assert(key, 'pushToSet: key must be defined');
  assert(value, 'pushToSet: value must be defined');

  const result = await executeCmd(await cmd('saddAsync', [prefixKey(ctx, key), value]));
  await setExpiration(ctx, key, expirationTime);

  return result;
};

export const getSet = async (ctx: IDbContext, key: string = ''): Promise<Array<string>> => await executeCmd(await cmd('smembersAsync', [prefixKey(ctx, key)]));

export const getSetLength = async (ctx: IDbContext, key: string = ''): Promise<number> => await executeCmd(await cmd('scardAsync', [prefixKey(ctx, key)]));

export const doesSetMemberExist = async (ctx: IDbContext, key: string = '', value: string = ''): Promise<boolean> =>
  (await executeCmd(await cmd('sismemberAsync', [prefixKey(ctx, key), value]))) === KEY_EXISTS;

export const deleteSetMember = async (ctx: IDbContext, key: string = '', value: string = ''): Promise<boolean> =>
  (await executeCmd(await cmd('sremAsync', [prefixKey(ctx, key), key, value]))) > 0;

export const disconnect = (): boolean => {
  if (!redisClient || !redisClient.connected) {
    logger.warn('Redis client is already disconnected');
    return false;
  }

  logger.info('Disconnecting redis client');
  redisClient.quit();
  return true;
};
