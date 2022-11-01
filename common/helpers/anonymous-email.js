/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const anonymizedEmails = {
  'zlead.co': [/^.{26}@zlead.co$/],
  'reply.craigslist.org': [/^.{32}@reply.craigslist.org$/],
  'renter.apartmentlist.com': [/^.+\..+\..{5}@renter.apartmentlist.com$/],
  'messaging.yelp.com': [/^reply\+([^@]*)@messaging.yelp.com$/],
  'message.my.apartmentguide.com': [/^reply-([^@]*)@message.my.apartmentguide.com$/],
  'email.rent.com': [/^reply-([^@]*)@email.rent.com$/],
  'abodoapts.com': [/^abodoleads\+([^@]*)@abodoapts.com$/],
};

const isAnonymizedEmail = (email, searchExpressions = []) => searchExpressions.some(expression => new RegExp(expression, 'i').test(email));

export const isAnonymousEmail = email => email && Object.keys(anonymizedEmails).some(provider => isAnonymizedEmail(email, anonymizedEmails[provider]));
