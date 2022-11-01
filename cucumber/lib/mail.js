/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import imaps from 'imap-simple';
import logger from '../../common/helpers/logger';
import { addAlias } from './utils/addAlias';

const MAX_ATTEMPTS = 20;

const fetchOptions = {
  bodies: ['HEADER', 'TEXT'],
  markSeen: true,
};

export async function generalSearch({ openBoxLabel, emailTo, filterByUnseen, parseOptions, attempts, userConfig: { imap, email, password } }) {
  const imapConfig = {
    ...imap,
    user: email,
    password,
  };
  logger.trace(
    {
      imapConfig,
    },
    'imapConfig to use to connect',
  );
  const connection = await imaps.connect({
    imap: imapConfig,
  });
  await connection.openBox(openBoxLabel);

  function delayedSearch(time = 0) {
    logger.trace(`performing a delayed search after: ${time}ms`);
    return new Promise(resolve => {
      setTimeout(() => {
        const criteria = ['ALL', ['TO', emailTo], filterByUnseen ? 'UNSEEN' : 'ALL'];
        logger.trace(
          {
            criteria,
          },
          'search emails using the provided criteria',
        );
        connection
          .search(criteria, fetchOptions)
          .then(resolve)
          .catch(error => {
            logger.error(
              {
                error,
              },
              'error during email search',
            );
            resolve([]);
          });
      }, time);
    });
  }

  async function doSearch(tryCount) {
    logger.trace(`attempting search up to ${tryCount} times`);
    let result = [];
    let attemptsLeft = attempts;
    while (attemptsLeft && !result.length) {
      logger.trace(`attempts left: ${attemptsLeft}`);
      // initially wait 1 second - then wait for 250ms more on each attempt
      result = await delayedSearch(1000 + (tryCount - attemptsLeft) * 250);
      // uncomment this line to debug received emails in cucumber
      // logger.trace({ result }, 'received results');
      attemptsLeft--;
    }
    return result;
  }

  async function getSearchResult(options) {
    const searchResults = await doSearch(attempts);
    logger.trace(searchResults, 'search results');
    let value;
    if (searchResults.length) {
      logger.trace(searchResults, 'marking search results seen');

      // TODO: please add an explanation of the expected format  of the body and
      // how this regex works.  regexes of this nature should have separate unit tests
      const body = searchResults.map(res => res.parts.filter(part => part.body)[0].body);

      // Match all string with regex value
      value = body[0].match(options.regexValue);
      // Replace new lines, symbols,etc
      value = value[0].replace(options.regexReplace, '');
      logger.trace(`got value ${value}`);
    }
    return value;
  }

  // Get results of email search
  const result = await getSearchResult(parseOptions);

  connection.end();
  logger.trace({ result }, 'ended connection');
  return result;
}

export const searchInviteToken = async ({ userConfig: { imap, email, password }, emailTo, attempts = MAX_ATTEMPTS }) => {
  const parseOptions = {
    regexValue: /code([^"]*)/g,
    regexReplace: /(?:\\[=rn]|[=\r\n]+)+/g,
  };

  const openBoxLabel = 'Invite || Your Account is Ready';
  return generalSearch({
    openBoxLabel,
    emailTo,
    parseOptions,
    attempts,
    userConfig: {
      imap,
      email,
      password,
    },
  });
};

export const searchTokenResetPassword = async ({ userConfig: { imap, email, password }, emailTo, attempts = MAX_ATTEMPTS }) => {
  const parseOptions = {
    regexValue: /resetPassw([^"]*)/g,
    regexReplace: /(?:(resetPassword\/|[=\n])+)+/g,
  };

  const openBoxLabel = 'Reset Password';
  return generalSearch({
    openBoxLabel,
    emailTo,
    parseOptions,
    attempts,
    userConfig: {
      imap,
      email,
      password,
    },
  });
};

export const applyTestIdToEmail = (email, testId) => (testId ? addAlias(email, testId) : email);

export const getApplyNowLink = async ({ userConfig: { imap, email, password }, emailTo, attempts = MAX_ATTEMPTS, testId, filterByUnseen = true }) => {
  const parseOptions = {
    regexValue: /([^"]*)applyNow([^"]*)/g,
    regexReplace: /([=\r\n])+/g,
  };

  const openBoxLabel = 'Quotes';
  const emailToWithTestId = applyTestIdToEmail(emailTo, testId);
  return generalSearch({
    openBoxLabel,
    emailTo: emailToWithTestId,
    filterByUnseen,
    parseOptions,
    attempts,
    userConfig: {
      imap,
      email,
      password,
    },
  });
};

export const getRegisterLink = async ({ userConfig: { imap, email, password }, emailTo, attempts = MAX_ATTEMPTS, testId }) => {
  const parseOptions = {
    regexValue: /(recipientCompleteRegistrationUrl" href=3D")([^"]*)/gm,
    regexReplace: /([=\r\n])+/g,
  };

  const openBoxLabel = 'Register';
  const emailToWithTestId = applyTestIdToEmail(emailTo, testId);
  const result = await generalSearch({
    openBoxLabel,
    emailTo: emailToWithTestId,
    parseOptions,
    attempts,
    userConfig: {
      imap,
      email,
      password,
    },
  });

  return result ? result.replace('recipientCompleteRegistrationUrl" href3D"', '') : result;
};
