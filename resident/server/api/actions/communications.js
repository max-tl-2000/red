/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import merge from 'lodash/merge';
import { getPersonByEmailAddress, getPersonById } from '../../../../server/services/person';
import { ServiceError } from '../../../../server/common/errors';
import {
  getDirectMessages as commServiceGetDirectMessages,
  handleIncomingDirectMessage as commsServiceHandleIncomingDirectMessages,
  getUserNotifications as commServiceGetUserNotifications,
} from '../../../../server/services/communication';
import * as cohortCommsService from '../../../../server/services/cohortCommsService';
import { hasOverduePaymentsByProperty } from '../../services/payment';

export const getDirectMessages = async req => {
  req.log?.trace?.({ ctx: req }, 'getDirectMessages');

  // in resident-api we have the commonUserId and email in the
  // property consumerToken that is added by the consumerTokenMiddleware
  const { personId } = req.middlewareCtx || {};
  const { propertyId } = req.params;

  if (!personId) {
    req.log?.error?.({ ctx: req }, 'Error getting direct messages, no person found');
    throw new ServiceError({ token: 'PERSON_DOES_NOT_EXIST', status: 404 });
  }
  const person = await getPersonById(req, personId);

  return { type: 'json', content: await commServiceGetDirectMessages(req, person, propertyId) };
};

export const handleIncomingDirectMessage = async req => {
  req.log?.trace?.({ ctx: req }, 'handleIncomingDirectMessage');

  const {
    body: { message },
    params: { propertyId },
  } = req;

  const { personId } = req.middlewareCtx || {};

  if (!personId) {
    req.log?.error?.({ ctx: req }, 'Error getting direct messages, no person found');
    throw new ServiceError({ token: 'PERSON_DOES_NOT_EXIST', status: 404 });
  }

  if (!message) {
    req.log?.error({ ctx: req }, 'Error sending direct message, no message was found');
    throw new ServiceError({ token: 'MESSAGE_REQUIRED', status: 400 });
  }
  const person = await getPersonById(req, personId);

  return { type: 'json', content: await commsServiceHandleIncomingDirectMessages(req, person, propertyId, message) };
};

export const getUserPosts = async req => {
  req.log?.trace?.({ ctx: req }, 'getUserPosts');

  const { personId } = req.middlewareCtx || {};
  const { propertyId } = req.params;

  return { type: 'json', content: await cohortCommsService.getUserPosts(req, personId, propertyId) };
};

export const getUserPost = async req => {
  req.log?.trace?.({ ctx: req }, 'getUserPosts');

  const { personId } = req.middlewareCtx || {};
  const { propertyId, postId } = req.params;

  if (!personId || !propertyId || !postId) {
    throw new ServiceError({ token: 'MISSING_REQUIRED_PARAMS', status: 412 });
  }

  return { type: 'json', content: await cohortCommsService.getUserPost(req, personId, propertyId, postId) };
};

export const markPostsAsRead = async req => {
  req.log?.trace?.({ ctx: req }, 'markPostsAsRead');

  const { personId } = req.middlewareCtx || {};
  const { propertyId } = req.params;

  const {
    body: { postIds },
  } = req;

  if (!personId) {
    req.log?.error?.({ ctx: req }, 'Error marking posts, no personId found');
    throw new ServiceError({ token: 'PERSON_DOES_NOT_EXIST', status: 404 });
  }

  if (!postIds || !postIds.length) {
    req.log?.error?.({ ctx: req }, 'Error marking posts, no ids found');
    throw new ServiceError({ token: 'POST_ID_REQUIRED', status: 400 });
  }
  return { type: 'json', content: await cohortCommsService.markPostsAsRead(req, personId, postIds, propertyId) };
};

export const markPostAsClicked = async req => {
  req.log?.trace?.({ ctx: req }, 'markPostClicked');

  const { personId } = req.middlewareCtx || {};
  const { propertyId } = req.params;

  const {
    body: { postId },
  } = req;

  if (!personId) {
    req.log?.error?.({ ctx: req }, 'Error marking posts, no personId found');
    throw new ServiceError({ token: 'PERSON_DOES_NOT_EXIST', status: 404 });
  }

  if (!postId) {
    req.log?.error?.({ ctx: req }, 'Error marking post as clicked, no postId found');
    throw new ServiceError({ token: 'POST_ID_REQUIRED', status: 400 });
  }

  return { type: 'json', content: await cohortCommsService.markPostAsClicked(req, personId, postId, propertyId) };
};

export const markLinkAsVisited = async req => {
  req.log?.trace?.({ ctx: req }, 'markLinkAsVisited');

  const { personId } = req.middlewareCtx || {};
  const { propertyId } = req.params;

  const {
    body: { postId, link },
  } = req;

  if (!personId) {
    req.log?.error?.({ ctx: req }, 'Error marking posts, no personId found');
    throw new ServiceError({ token: 'PERSON_DOES_NOT_EXIST', status: 404 });
  }

  if (!postId) {
    req.log?.error?.({ ctx: req }, 'Error marking link as visited, no postId found');
    throw new ServiceError({ token: 'POST_ID_REQUIRED', status: 400 });
  }

  if (!link) {
    req.log?.error?.({ ctx: req }, 'Error marking link as visited, no link found');
    throw new ServiceError({ token: 'LINK_REQUIRED', status: 400 });
  }

  return { type: 'json', content: await cohortCommsService.markLinkAsVisited(req, personId, postId, link, propertyId) };
};

export const markDirectMessagesAsRead = async req => {
  req.log?.trace?.({ ctx: req }, 'markDirectMessagesAsRead');

  const { personId } = req.middlewareCtx || {};

  const {
    body: { messageIds },
  } = req;

  if (!personId) {
    req.log?.error?.({ ctx: req }, 'Error marking messages, no personId found');
    throw new ServiceError({ token: 'PERSON_DOES_NOT_EXIST', status: 404 });
  }

  if (!messageIds || !messageIds.length) {
    req.log?.error?.({ ctx: req }, 'Error marking messages, no ids found');
    throw new ServiceError({ token: 'DIRECT_MESSAGE_ID_REQUIRED', status: 400 });
  }

  return { type: 'json', content: await cohortCommsService.markDirectMessagesAsRead(req, personId, messageIds) };
};

export const getUserNotifications = async req => {
  req.log?.trace?.({ ctx: req }, 'getUserNotifications');

  const { consumerToken } = req.middlewareCtx || {};
  const { email } = consumerToken;
  const propertyIds = req.query.propertyIds?.split(',');
  if (!email) {
    req.log?.error?.({ ctx: req }, 'Error getting direct messages, no person email');
    throw new ServiceError({ token: 'EMAIL_DOES_NOT_EXIST', status: 400 });
  }

  const person = await getPersonByEmailAddress(req, email);

  if (!person) {
    req.log?.error?.({ ctx: req }, 'Error getting direct messages, no person found');
    throw new ServiceError({ token: 'PERSON_DOES_NOT_EXIST', status: 404 });
  }

  if (!propertyIds?.length) {
    req.log?.error?.({ ctx: req }, 'Error getting direct messages, no properties found');
    throw new ServiceError({ token: 'PROPERTY_IDS_MISSING', status: 404 });
  }

  const unreadMessagesInfo = await commServiceGetUserNotifications(req, person, propertyIds);

  const overduePaymentsInfo = await hasOverduePaymentsByProperty(req, propertyIds, person.id);

  return { type: 'json', content: merge(unreadMessagesInfo, overduePaymentsInfo) };
};
