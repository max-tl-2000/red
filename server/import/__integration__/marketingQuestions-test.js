/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { testCtx as ctx, createAMarketingQuestion } from '../../testUtils/repoHelper';
import '../../testUtils/setupTestGlobalContext';
import { importMarketingQuestions } from '../inventory/marketingQuestions';
import { getMarketingQuestions } from '../../dal/marketingQuestionsRepo';

describe('import/marketingQuestions', () => {
  describe('when importing a new marketing question', () => {
    it('will save the marketing question', async () => {
      const firstMarketingQuestion = {
        name: 'firstName',
        displaySectionQuestion: 'dsq',
        displayPrimaryQuestion: 'Do you have pets?',
        displayPrimaryQuestionDescription: 'pets',
        displayFollowupQuestion: 'How many?',
        inputTypeForFollowupQuestion: 'count',
        enumValues: null,
        inactiveFlag: '',
        displayOrder: 1,
      };

      const secondMarketingQuestion = {
        name: 'secondName',
        displaySectionQuestion: 'dsq',
        displayPrimaryQuestion: '',
        displayPrimaryQuestionDescription: 'storage',
        displayFollowupQuestion: 'How big?',
        inputTypeForFollowupQuestion: 'count',
        enumValues: null,
        inactiveFlag: '',
        displayOrder: 2,
      };

      const marketingQuestionsRows = [
        {
          data: firstMarketingQuestion,
          index: 1,
        },
        {
          data: secondMarketingQuestion,
          index: 2,
        },
      ];

      await importMarketingQuestions(ctx, marketingQuestionsRows);

      const marketingQuestions = await getMarketingQuestions(ctx);
      expect(marketingQuestions.length).to.equal(2);
    });
  });

  describe('when importing a new marketing question without displayOrder', () => {
    it('will save the marketing question with displayOrder set to 0', async () => {
      const firstMarketingQuestion = {
        name: 'firstName',
        displaySectionQuestion: 'dsq',
        displayPrimaryQuestion: 'Do you have pets?',
        displayPrimaryQuestionDescription: 'pets',
        displayFollowupQuestion: 'How many?',
        inputTypeForFollowupQuestion: 'count',
        enumValues: null,
        inactiveFlag: '',
        displayOrder: '',
      };

      const secondMarketingQuestion = {
        name: 'secondName',
        displaySectionQuestion: 'dsq',
        displayPrimaryQuestion: '',
        displayPrimaryQuestionDescription: 'storage',
        displayFollowupQuestion: 'How big?',
        inputTypeForFollowupQuestion: 'count',
        enumValues: null,
        inactiveFlag: '',
        displayOrder: 2,
      };

      const marketingQuestionsRows = [
        {
          data: firstMarketingQuestion,
          index: 1,
        },
        {
          data: secondMarketingQuestion,
          index: 2,
        },
      ];

      await importMarketingQuestions(ctx, marketingQuestionsRows);

      const marketingQuestions = await getMarketingQuestions(ctx);
      expect(marketingQuestions.length).to.equal(2);
      expect(marketingQuestions[0].displayOrder).to.equal(0);
    });
  });

  describe('when importing a valid, already imported marketing question', () => {
    it('will update the existing one', async () => {
      const dbMarketingQuestion = await createAMarketingQuestion();
      const {
        name,
        displaySectionQuestion,
        displayPrimaryQuestion,
        displayPrimaryQuestionDescription,
        displayFollowupQuestion,
        inputTypeForFollowupQuestion,
      } = dbMarketingQuestion;

      const marketingQuestionRow = [
        {
          data: {
            name,
            displaySectionQuestion,
            displayPrimaryQuestion,
            displayPrimaryQuestionDescription,
            displayFollowupQuestion,
            inputTypeForFollowupQuestion,
            enumValues: '',
            inactiveFlag: 'X',
            displayOrder: 1,
          },
          index: 1,
        },
      ];

      await importMarketingQuestions(ctx, marketingQuestionRow);

      const marketingQuestions = await getMarketingQuestions(ctx);

      expect(marketingQuestions.length).to.equal(1);

      expect(dbMarketingQuestion.inactive).to.be.false;
      expect(marketingQuestions[0].inactive).to.be.true;
    });
  });

  describe('when importing a row with empty displayPrimaryQuestion and displayFollowupQuestion', () => {
    it('will retun an error', async () => {
      const firstMarketingQuestion = {
        name: 'firstName',
        displaySectionQuestion: 'dsq',
        displayPrimaryQuestion: '',
        displayPrimaryQuestionDescription: 'pets',
        displayFollowupQuestion: '',
        inputTypeForFollowupQuestion: 'count',
        enumValues: null,
        inactiveFlag: '',
        displayOrder: 1,
      };

      const marketingQuestionsRows = [
        {
          data: firstMarketingQuestion,
          index: 1,
        },
      ];

      const { invalidFields: importErrors } = await importMarketingQuestions(ctx, marketingQuestionsRows);
      const marketingQuestions = await getMarketingQuestions(ctx);

      expect(marketingQuestions.length).to.equal(0);
      expect(importErrors.length).to.equal(1);
      expect(importErrors[0].index).to.equal(1);
      expect(importErrors[0].invalidFields[0]).to.deep.equal({
        name: 'displayPrimaryQuestion',
        message: 'Every item should have at least one level of question',
      });
    });
  });
});
