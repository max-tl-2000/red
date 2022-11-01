/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import omit from 'lodash/omit';
import path from 'path';
import serverConfig from '../config';

import {
  getPostsByPersonIdAndPropertyId,
  createPost as createPostRepo,
  deletePost as deletePostRepo,
  getPostById as getPostByIdRepo,
  deletePostRecipientByPostId as deletePostRecipientByPostIdRepo,
  updatePostById,
  getRecipientFilesByPostId,
  getDraftPosts as getDraftPostsRepo,
  updatePostsAsRead,
  updateDirectMessagesAsRead,
  getNumberOfRecipientsByPostId,
  getPostRecipientsByPostId,
  getSentPosts,
  getPostByPersonIdAndPropertyIdAndPostId,
  getPostRecipientToDownload,
  updatePostAsClicked,
  updatePostLinkAsVisited,
  getPostStatistics,
  updatePostAsRetracted,
  markRetractedPostAsRead,
} from '../dal/cohortCommsRepo';
import { getPublicDocumentById } from '../dal/publicDocumentRepo';
import { ServiceError } from '../common/errors';
import loggerModule from '../../common/helpers/logger';
import { now } from '../../common/helpers/moment-utils.ts';
import { deleteDocuments } from './documents';
import { DALTypes } from '../../common/enums/DALTypes';
import { APP_EXCHANGE, IMPORT_COHORT_MESSAGE_TYPE, DELAYED_APP_EXCHANGE, DELAYED_MESSAGE_TYPE } from '../helpers/message-constants';
import { createJob } from './jobs';
import { sendMessage } from './pubsub';
import { notify, RESIDENTS } from '../../common/server/notificationClient';
import eventTypes from '../../common/enums/eventTypes';
import { getCommonUserByPersonId, getCommonUserByPersonIds } from '../../auth/server/dal/common-user-repo.js';
import { getS3URLForPublicDocumentById } from '../workers/upload/publicDocuments/publicDocumentS3Upload';
import { sendPushNotification } from '../../common/server/push-notifications';
import { truncateForPushNotificationBody, sanitizeFilename } from '../../common/helpers/strings';
import { getS3Provider } from '../workers/upload/s3Provider';
import { getDocumentsKeyPrefix, getPrivateBucket, getEncryptionKeyId } from '../workers/upload/uploadUtil';
import { write } from '../../common/helpers/xfs';
import { transformMapsToCSV } from '../export/yardi/csvUtils';
import { downloadDocument } from '../workers/upload/documents/documentsS3Upload';
import { getTeamsForParties } from '../dal/partyRepo';
import { extractPostMessage } from './helpers/communicationHelpers';
import { getDirectMessageThreadIdByPartiesAndPersons } from '../dal/communicationRepo';

const logger = loggerModule.child({ subType: 'cohortCommsService' });
const DIRECTORY = './.temp/';
const PREFIX = 'postRecipientResult';
const SUFFIX = 'csv';
const bucket = getPrivateBucket();

const deletePostRecipientFile = async (ctx, file) => {
  logger.trace({ ctx, file }, 'Sending delayed message to delete the post recipient file');

  await sendMessage({
    exchange: DELAYED_APP_EXCHANGE,
    key: DELAYED_MESSAGE_TYPE.DELETE_POST_RECIPIENT_RESULT_FILE,
    message: {
      tenantId: ctx.tenantId,
      file,
    },
    ctx: {
      ...ctx,
      delay: Number(serverConfig.aws.deletePostRecipientFileDelay),
    },
  });
};

const addPreviewStatisticsToPosts = async (ctx, posts) => {
  const postIds = posts.map(post => post.id);
  logger.trace({ ctx, postIds }, 'addPreviewStatisticsToPosts');

  const statistics = await getPostStatistics(ctx, postIds);
  const results = posts.map(post => ({
    ...post,
    previewStatistics: statistics.find(ps => ps.postId === post.id),
  }));

  return results;
};

const buildDataWithPublicDocumentInfo = async (ctx, post) => {
  const heroImage = await getPublicDocumentById(ctx, post?.publicDocumentId);
  if (heroImage) {
    post.heroImageMetada = {
      id: heroImage.uuid,
      name: heroImage.metadata?.file?.originalName,
      size: heroImage.metadata?.file?.size,
    };
    post.heroImageURL = getS3URLForPublicDocumentById(ctx, heroImage.physicalPublicDocumentId);
  }
  return post;
};

export const getPosts = async (ctx, { userTeamIds, filters }) => {
  logger.trace({ ctx, userTeamIds, filters }, 'getPosts');

  const posts = await getSentPosts(ctx, userTeamIds, filters);

  const totalRows = posts[0]?.count || 0;
  const rowsResultsPromises = posts.map(async row => {
    const { count, ...rest } = row;
    const postWithPublicDocument = await buildDataWithPublicDocumentInfo(ctx, rest);

    return postWithPublicDocument;
  });

  const rows = await Promise.all(rowsResultsPromises);

  const rowsWithPreviewStatistics = await addPreviewStatisticsToPosts(ctx, rows);

  return {
    totalRows,
    rows: rowsWithPreviewStatistics,
  };
};

const enhancePostWithHeroImage = (ctx, post) => {
  logger.trace({ ctx, postId: post?.id }, 'enhance post with hero image');
  post.heroImageURL = null;
  if (post?.physicalPublicDocumentId) {
    post.heroImageURL = getS3URLForPublicDocumentById(ctx, post.physicalPublicDocumentId);
  }
  return post;
};

const enhancePostWithHasMessageDetailsFlag = (ctx, post) => {
  logger.trace({ ctx, postId: post?.id }, 'enhance post hasMessageDetails flag');
  post.hasMessageDetails = !!post.messageDetails;
  delete post.messageDetails;
  return post;
};

const defaultPostColumns = ['id', 'category', 'title', 'message', 'sentAt', 'retractedAt', 'publicDocumentId', 'metadata'];
const allPostColumns = [...defaultPostColumns, 'messageDetails'];
const postForSendingColumns = [...defaultPostColumns, 'rawMessage', 'messageDetails'];

export const getUserPosts = async (ctx, personId, propertyId) => {
  logger.trace({ ctx, personId, propertyId }, 'getUserPosts');

  const posts = await getPostsByPersonIdAndPropertyId(ctx, personId, propertyId, allPostColumns);
  return posts.map(post => {
    const postWithHeroImage = enhancePostWithHeroImage(ctx, post);
    return enhancePostWithHasMessageDetailsFlag(ctx, postWithHeroImage);
  });
};

export const getUserPost = async (ctx, personId, propertyId, postId) => {
  logger.trace({ ctx, personId, propertyId, postId }, 'getUserPost');

  const post = await getPostByPersonIdAndPropertyIdAndPostId(ctx, personId, propertyId, postId, allPostColumns);

  return post ? enhancePostWithHeroImage(ctx, post) : null;
};

const verifyIfPostCanBeUpdated = (ctx, post) => {
  if (!post) {
    throw new ServiceError({
      token: 'POST_DOES_NOT_EXIST',
      status: 412,
    });
  }
  if (post.sentAt) {
    logger.error({ ctx, postId: post.id }, 'Cannot update a sent post');
    throw new ServiceError({
      token: 'CANNOT_UPDATE_A_SENT_POST',
      status: 412,
    });
  }
};

const canPostBeUpdated = async (ctx, postId) => {
  const postColumnsToRetrieve = ['id', 'sentAt'];
  const postFromDB = await getPostByIdRepo(ctx, postId, postColumnsToRetrieve);
  verifyIfPostCanBeUpdated(ctx, postFromDB);

  return postFromDB;
};

const buildPostInfo = ({ category, title, message, messageDetails, rawMessage, rawMessageDetails, userId }, isCreatingPost) => {
  const postInfo = {
    title,
    message,
    messageDetails,
    rawMessage,
    rawMessageDetails,
    updatedBy: userId,
  };
  if (isCreatingPost) {
    postInfo.category = category;
    postInfo.createdBy = userId;
  }

  return postInfo;
};

const buildDataWithDocumentInfoIfExist = async (ctx, post) => {
  const recipientFiles = await getRecipientFilesByPostId(ctx, post.id);

  if (recipientFiles?.length) {
    post.documentMetadata = {
      id: recipientFiles[0].metadata?.file?.id,
      name: recipientFiles[0].metadata?.file?.originalName,
      size: recipientFiles[0].metadata?.file?.size,
      matchingResidentInfo: recipientFiles[0].metadata?.document?.matchingResidentInfo || {},
    };
  }

  if (post.sentAt) {
    post.numberOfRecipients = await getNumberOfRecipientsByPostId(ctx, post.id);
  }

  return post;
};

export const createPost = async (ctx, post) => {
  logger.trace({ ctx, category: post.category }, 'Create post');

  const postInfo = buildPostInfo({ ...post, userId: ctx.authUser.id }, true);

  const postCreated = await createPostRepo(ctx, postInfo);
  const postWithPublicDocument = await buildDataWithPublicDocumentInfo(ctx, postCreated);
  const { message, messageDetails, rawMessage, rawMessageDetails, ...restPostWithDocumentInfo } = await buildDataWithDocumentInfoIfExist(ctx, {
    ...postWithPublicDocument,
    createdBy: ctx.authUser.fullName,
  });

  await notify({
    ctx,
    event: eventTypes.POST_CREATED,
    data: {
      post: restPostWithDocumentInfo,
    },
  });

  return { ...restPostWithDocumentInfo, message, messageDetails, rawMessage, rawMessageDetails };
};

export const updatePost = async (ctx, post) => {
  const { postId } = post;
  logger.trace({ ctx, postId }, 'Update post');

  const postFromDB = await canPostBeUpdated(ctx, postId);
  const postInfo = buildPostInfo({ ...post, userId: ctx.authUser.id }, false);

  const postUpdated = await updatePostById(ctx, postFromDB.id, postInfo);
  const postWithPublicDocument = await buildDataWithPublicDocumentInfo(ctx, postUpdated);
  const { message, messageDetails, rawMessage, rawMessageDetails, ...restPostWithDocumentInfo } = await buildDataWithDocumentInfoIfExist(ctx, {
    ...postWithPublicDocument,
    createdBy: postFromDB.createdBy,
  });

  await notify({
    ctx,
    event: eventTypes.POST_UPDATED,
    data: {
      post: restPostWithDocumentInfo,
    },
  });

  return { ...restPostWithDocumentInfo, message, messageDetails, rawMessage, rawMessageDetails };
};

const verifyIfPostCanBeSent = async (ctx, post) => {
  if (!post.title || !post.message) {
    logger.error({ ctx, post }, 'Cannot send the post');
    throw new ServiceError({
      token: 'TITLE_AND_MESSAGE_IS_REQUIRED',
      status: 412,
    });
  }

  const recipientFiles = await getRecipientFilesByPostId(ctx, post.id);
  if (!recipientFiles.length) {
    logger.error({ ctx, post }, 'Cannot send the post');
    throw new ServiceError({
      token: 'RECIPIENT_FILE_REQUIRED',
      status: 412,
    });
  }

  return recipientFiles[0].uuid;
};

export const getCohortFile = async (req, body) => {
  logger.trace({ req, body }, 'getCohortFile');

  const { postId, fileId } = body;

  const jobDetails = {
    name: DALTypes.Jobs.ImportCohortFiles,
    step: DALTypes.ImportCohortFileSteps.IMPORT_COHORT,
    messageKey: IMPORT_COHORT_MESSAGE_TYPE.IMPORT_COHORT,
    category: DALTypes.JobCategory.CohortComms,
    status: DALTypes.JobStatus.IN_PROGRESS,
  };

  const job = await createJob(req, [], jobDetails);

  const payload = {
    jobDetails: {
      id: job.id,
      step: jobDetails.step,
      name: jobDetails.name,
      createdBy: req.authUser?.id,
      postId,
      fileId,
    },
    tenantId: req.tenantId,
    isUIImport: req?.body?.isUIImport,
  };

  await sendMessage({
    exchange: APP_EXCHANGE,
    key: jobDetails.messageKey,
    message: payload,
    ctx: req,
  });
};

export const markPostAsSent = async (ctx, postId) =>
  await updatePostById(ctx, postId, { updatedBy: ctx.authUser.id, sentAt: now().toJSON(), sentBy: ctx.authUser.id });

export const sendPost = async (ctx, post) => {
  const { postId } = post;
  logger.trace({ ctx, postId }, 'Send post');

  const postFromDB = await getPostByIdRepo(ctx, postId);

  if (!postFromDB) {
    throw new ServiceError({
      token: 'POST_DOES_NOT_EXIST',
      status: 412,
    });
  }

  if (postFromDB.sentAt) {
    throw new ServiceError({
      token: 'POST_ALREADY_SENT',
      status: 412,
    });
  }

  const postUpdated = await updatePost(ctx, post);

  const recipientFileId = await verifyIfPostCanBeSent(ctx, postUpdated);

  return await getCohortFile(ctx, { postId: postUpdated.id, fileId: recipientFileId });
};

export const deletePost = async (ctx, postId) => {
  logger.trace({ ctx, postId }, 'Delete post');

  if (!postId) {
    logger.error({ ctx }, 'Error deleting post no postId found');
    throw new ServiceError({ token: 'POST_ID_REQUIRED', status: 400 });
  }

  const documents = await getRecipientFilesByPostId(ctx, postId);
  const documentIds = documents.map(document => document.uuid);

  await deleteDocuments(ctx, documentIds);
  await deletePostRecipientByPostIdRepo(ctx, postId);
  await deletePostRepo(ctx, postId);

  await notify({
    ctx,
    event: eventTypes.POST_DELETED,
    data: {
      postId,
    },
  });
};

export const getDraftPosts = async ctx => {
  logger.trace({ ctx }, 'getDraftPosts');

  return await getDraftPostsRepo(ctx);
};

export const markPostsAsRead = async (ctx, personId, postIds, propertyId) => {
  logger.trace({ ctx, personId, postIds, propertyId }, 'Marking posts as read');

  return await updatePostsAsRead(ctx, personId, postIds, propertyId);
};

export const markDirectMessagesAsRead = async (ctx, personId, messageIds) => {
  logger.trace({ ctx, personId, messageIds }, 'Marking direct messages as read');

  return await updateDirectMessagesAsRead(ctx, personId, messageIds);
};

export const markPostAsClicked = async (ctx, personId, postId, propertyId) => {
  logger.trace({ ctx, personId, postId, propertyId }, 'Marking post as clicked');

  return await updatePostAsClicked(ctx, personId, postId, propertyId);
};

export const markLinkAsVisited = async (ctx, personId, postId, link, propertyId) => {
  logger.trace({ ctx, personId, postId, link, propertyId }, 'Marking post link as visited');

  return await updatePostLinkAsVisited(ctx, personId, postId, link, propertyId);
};

const addStatisticsToPost = async (ctx, post) => {
  logger.trace({ ctx, postId: post.id }, 'addStatisticsToPost');

  const postStatistics = await getPostStatistics(ctx, [post.id], true);
  return { ...post, postStatistics };
};

export const getPostById = async (ctx, postId) => {
  if (!postId) {
    logger.error({ ctx }, 'No postId found');
    throw new ServiceError({ token: 'POST_ID_REQUIRED', status: 404 });
  }
  const post = await getPostByIdRepo(ctx, postId);
  const postWithPublicDocument = await buildDataWithPublicDocumentInfo(ctx, post);
  const postWithDocumentInfo = await buildDataWithDocumentInfoIfExist(ctx, postWithPublicDocument);
  return await addStatisticsToPost(ctx, postWithDocumentInfo);
};

export const getUserPostById = async (ctx, postId) => {
  if (!postId) {
    logger.error({ ctx }, 'No postId found');
    throw new ServiceError({ token: 'POST_ID_REQUIRED', status: 404 });
  }
  const post = await getPostByIdRepo(ctx, postId, postForSendingColumns);
  const postWithHasMessageDetailsFlag = enhancePostWithHasMessageDetailsFlag(ctx, post);
  const postWithPublicDocument = await buildDataWithPublicDocumentInfo(ctx, postWithHasMessageDetailsFlag);
  return await buildDataWithDocumentInfoIfExist(ctx, postWithPublicDocument);
};

const postMessageToNotificationBody = post => truncateForPushNotificationBody(extractPostMessage(post));

export const notifyPersons = async (ctx, postId) => {
  const post = await getUserPostById(ctx, postId);
  const postRecipients = await getPostRecipientsByPostId(ctx, postId);
  const usersInfo = await mapSeries(postRecipients, async postRecipient => {
    const { personId, propertyId, partyIds } = postRecipient;
    const commonUserId = (await getCommonUserByPersonId(ctx, personId))?.id;
    const teams = await getTeamsForParties(ctx, partyIds);
    const { threadId } = await getDirectMessageThreadIdByPartiesAndPersons(ctx, partyIds, [personId]);

    await notify({
      ctx,
      event: eventTypes.COMMUNICATION_UPDATE,
      data: { partyIds, threadIds: [threadId] },
      routing: { teams },
    });

    if (commonUserId) {
      notify({
        ctx: { tenantId: RESIDENTS, trx: ctx.trx },
        event: eventTypes.POST_TO_RXP,
        data: { ...post, unread: true, propertyId },
        routing: { users: [commonUserId], shouldFallbackToBroadcast: false },
      });
    }

    return { id: commonUserId, propertyId };
  });

  sendPushNotification(
    ctx,
    {
      body: postMessageToNotificationBody(post),
      title: post.title,
      data: {
        event: eventTypes.POST_TO_RXP,
        id: post.id,
        usersInfo,
      },
    },
    usersInfo.map(ui => ui.id).filter(id => !!id),
  );
};

const createPostRecipientCSVFile = async (ctx, data, postId) => {
  logger.trace({ ctx, postId }, 'createPostRecipientCSVFile');

  const csvFileContent = transformMapsToCSV('PostRecipient', data);
  const fileName = `${PREFIX}-${postId}.${SUFFIX}`;
  const filePath = path.join(DIRECTORY, fileName);
  await write(filePath, csvFileContent);
  return { filePath, fileName };
};

const saveDocumentToS3 = async (ctx, fileName, filePath) => {
  logger.trace({ ctx, fileName, filePath }, 'saveDocumentToS3');

  const keyPrefix = getDocumentsKeyPrefix(ctx.tenantId);
  const options = {
    encryptionType: 'aws:kms',
    keyId: getEncryptionKeyId(),
  };
  await getS3Provider().saveFile(ctx, bucket, `${keyPrefix}/${fileName}`, filePath, options);
};

const downloadDocumentFromS3 = (ctx, fileName) => {
  logger.trace({ ctx, fileName }, 'downloadDocumentFromS3');

  return {
    type: 'stream',
    filename: sanitizeFilename(fileName, { replaceUnicode: true }),
    stream: downloadDocument(ctx, fileName),
  };
};

export const downloadPostRecipientFile = async (ctx, postId) => {
  logger.trace({ ctx, postId }, 'downloadPostRecipientFile - service');
  let file;
  let stream;
  try {
    logger.info({ ctx: postId }, 'downloadPostRecipientFile - start');
    const data = await getPostRecipientToDownload(ctx, postId);
    const { protocol, domain } = ctx.authUser;
    const formattedData = data.map(postRecipient => {
      const revaPartyLink = postRecipient.partyId ? `${protocol}://${domain}/party/${postRecipient.partyId}` : null;
      return omit({ ...postRecipient, 'Reva party link': revaPartyLink }, ['partyId']);
    });

    const { filePath, fileName } = await createPostRecipientCSVFile(ctx, formattedData, postId);
    file = { filePath, fileName };
    await saveDocumentToS3(ctx, fileName, filePath);

    stream = downloadDocumentFromS3(ctx, fileName);
  } catch (error) {
    logger.error({ ctx, postId }, 'downloadPostRecipientFile - error');
    throw error;
  } finally {
    await deletePostRecipientFile(ctx, file);
    logger.info({ ctx, postId }, 'downloadPostRecipientFile - finished.');
  }
  return stream;
};

const notifyRetractedPost = async (ctx, postId) => {
  const post = await getUserPostById(ctx, postId);
  const postRecipients = await getPostRecipientsByPostId(ctx, postId);

  const personIds = postRecipients.map(p => p.personId);
  const commonUsers = await getCommonUserByPersonIds(ctx, personIds);

  await mapSeries(postRecipients, async postRecipient => {
    const { personId, propertyId } = postRecipient;
    const commonUserId = commonUsers.find(commonUser => commonUser.personId === personId)?.id;

    if (commonUserId) {
      notify({
        ctx: { tenantId: RESIDENTS, trx: ctx.trx },
        event: eventTypes.POST_TO_RXP,
        data: { ...post, propertyId },
        routing: { users: [commonUserId], shouldFallbackToBroadcast: false },
      });
    }

    return { id: commonUserId, propertyId };
  });
};

export const markPostAsRetracted = async (ctx, { postId, retractedReason }) => {
  logger.trace({ ctx, postId, retractedReason }, 'Marking post as retracted');
  const retractDetails = { retractedReason, retractedBy: ctx.authUser.fullName };

  const retractedPost = await updatePostAsRetracted(ctx, postId, retractDetails);
  await markRetractedPostAsRead(ctx, postId);
  await notifyRetractedPost(ctx, postId);
  return retractedPost;
};
