/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import { testCtx as ctx, createADocument, createAPublicDocument, updatePostPublicDocument, createAUser, createAPost } from '../../testUtils/repoHelper';
import '../../testUtils/setupTestGlobalContext';
import { getDraftPosts } from '../cohortCommsRepo';

import { DALTypes } from '../../../common/enums/DALTypes';

describe('dal/cohortCommsRepo', () => {
  describe('calling getDraftPosts function', () => {
    const initializeData = async () => {
      const user = await createAUser();

      const draftPostObjects = [
        {
          title: 'Draft post title 1',
          message: 'Draft post message 1',
          category: DALTypes.PostCategory.ANNOUNCEMENT,
          createdBy: user.id,
          updatedBy: user.id,
        },
        {
          title: 'Draft post title 2',
          message: 'Draft post message 2',
          category: DALTypes.PostCategory.EMERGENCY,
          createdBy: user.id,
          updatedBy: user.id,
        },
      ];
      const draftPosts = await Promise.all(draftPostObjects.map(post => createAPost(post)));
      const [firstPost, secondPost] = draftPosts;

      const firstDocId = newId();
      const secondDocId = newId();
      const documentsObjects = [
        {
          uuid: firstDocId,
          accessType: 'private',
          metadata: {
            file: { id: firstDocId, originalName: 'textFileName1', size: '9900' },
            document: {
              uploadingUser: user,
              context: DALTypes.PostCategory.ANNOUNCEMENT,
              postId: firstPost.id,
            },
          },
          context: DALTypes.PostCategory.ANNOUNCEMENT,
        },
        {
          uuid: secondDocId,
          accessType: 'private',
          metadata: {
            file: { id: secondDocId, originalName: 'textFileName2', size: '9999' },
            document: {
              uploadingUser: user,
              context: DALTypes.PostCategory.EMERGENCY,
              postId: secondPost.id,
            },
          },
          context: DALTypes.PostCategory.EMERGENCY,
        },
      ];

      const firstPublicDocId = newId();
      const secondPublicDocId = newId();
      const firstPhysicalPublicDocId = newId();
      const secondPhysicalPublicDocId = newId();
      const publicDocumentsObjects = [
        {
          uuid: firstPublicDocId,
          physicalPublicDocumentId: firstPhysicalPublicDocId,
          context: DALTypes.PostPublicDocumentContext.POST_HERO_IMAGE,
          metadata: {
            body: { postId: firstPost.id, context: DALTypes.PostPublicDocumentContext.POST_HERO_IMAGE },
            file: { id: firstPublicDocId, originalName: 'textFileName1.png', mimetype: 'image/png', size: '9900' },
            uploadingUser: user,
          },
        },
        {
          uuid: secondPublicDocId,
          physicalPublicDocumentId: secondPhysicalPublicDocId,
          context: DALTypes.PostPublicDocumentContext.POST_HERO_IMAGE,
          metadata: {
            body: { postId: secondPost.id, context: DALTypes.PostPublicDocumentContext.POST_HERO_IMAGE },
            file: { id: secondPublicDocId, originalName: 'textFileName2.png', mimetype: 'image/png', size: '9900' },
            uploadingUser: user,
          },
        },
      ];
      const documents = await Promise.all(documentsObjects.map(doc => createADocument(ctx, doc)));
      const publicDocuments = (
        await Promise.all(publicDocumentsObjects.map(doc => createAPublicDocument(ctx, doc, { shouldCreatePhysicalPublicDocument: true, checksum: newId() })))
      )?.flat(1);
      await Promise.all(publicDocuments.map(doc => updatePostPublicDocument(ctx, doc.metadata.body.postId, doc.uuid)));
      return { documents, publicDocuments, draftPosts, user };
    };

    describe('when there is data', () => {
      it('should return an array of draft posts with two items', async () => {
        await initializeData();
        const results = await getDraftPosts(ctx);
        expect(results).to.have.lengthOf(2);
      });

      it('should return an array of draft post objects', async () => {
        const { draftPosts, documents, user, publicDocuments } = await initializeData();

        const results = await getDraftPosts(ctx);
        const expectedMembers = draftPosts.map((post, index) => ({
          id: post.id,
          category: post.category,
          title: post.title,
          created_at: post.created_at,
          createdBy: user.fullName,
          documentMetadata: {
            id: documents[index].metadata.file.id,
            size: documents[index].metadata.file.size,
            name: documents[index].metadata.file.originalName,
          },
          heroImageMetada: {
            id: publicDocuments[index].uuid,
            size: publicDocuments[index].metadata.file.size,
            name: publicDocuments[index].metadata.file.originalName,
          },
        }));
        expect(results).to.have.deep.members(expectedMembers);
      });
    });

    describe('when there is not data', () => {
      it('should return an empty array of draft posts', async () => {
        const results = await getDraftPosts(ctx);

        expect(results).to.have.lengthOf(0);
      });
    });
  });
});
