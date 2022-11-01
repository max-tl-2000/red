/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// This filters out the main token(first position)  // output: 'avatarImage.imageUrl'
const getLastPartsFromToken = tokenParts => tokenParts.slice(1, tokenParts.length).join('.');

/**
 * This function returns a list of the tokens to expand by the current context, using the main token, ex:
 *   If the template requires the following tokens: 'recipient.name', 'recipient.phone', 'employee.name'
 *   This function will take the current main token and filter the tokens list by that, let's say the current(iteration) main token is 'recipient', so this function should return "['name', 'phone']"
 *   This way the 'mapViewModelKeys' function will not skip this tokens
 * @param {array} tokensToExpand - The complete list of tokens to expand on the template and subject
 * @param {string} mainToken - The current main token on 'getExpansionContextFromDb' iteration.
 */
export const getTokensToExpandByMainToken = (tokensToExpand, mainToken) =>
  tokensToExpand.reduce((acc, token) => {
    // Ex: 'employee.avatarImage.imageUrl'  // output: ['employee', 'avatarImage', imageUrl]
    const tokenParts = token.split('.');

    // If the current token has a different main token, returns
    if (mainToken !== tokenParts[0]) return acc;

    // If the token does not have several parts(ex: 'employee'), returns the main token = 'employee', if not, returns the last parts
    const viewModelToken = tokenParts.length === 1 ? tokenParts[0] : getLastPartsFromToken(tokenParts);

    acc.push(viewModelToken);
    return acc;
  }, []);

/**
 * Parse an incoming token into an object to extract parameters
 * @param {string} token - Token set in the email templates, i.g. employee.fullname, employee.heroImageUrl?r=2&w=1200&ar=4&c=fill
 */
const parseEmailContextToken = (token = '') => {
  const tokenParameters = token.match(/([^?&]+)=([^&]+)/g) || [];
  const parameters = tokenParameters.map(query => {
    const [, key, value] = query.match(/([^=]+)=(.+)/) || [];
    return { key, value };
  });

  return {
    token: token.match(/([^?]+)/)[0],
    originalToken: token,
    parameters,
  };
};

export const getParsedTokens = tokensToExpand => tokensToExpand.map(parseEmailContextToken);
