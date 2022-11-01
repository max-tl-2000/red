/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable global-require */
const { mockModules } = require('../../../common/test-helpers/mocker').default(jest);
const originalModule = require('../merge-branches-helpers.ts');

jest.resetModules();

describe('merge-branches', () => {
  let mergeBranches;
  let mocks;

  let buffers;

  beforeEach(() => {
    jest.resetModules();

    buffers = {
      ok: [],
      print: [],
      subtle: [],
      success: [],
      warn: [],
      error: [],
    };

    mocks = {
      print: (...args) => buffers.print.push(args),
      ok: (...args) => buffers.ok.push(args),
      subtle: (...args) => buffers.subtle.push(args),
      success: (...args) => buffers.success.push(args),
      warn: (...args) => buffers.warn.push(args),
      error: (...args) => buffers.error.push(args),
      doExec: jest.fn(),
      getCurrentBranch: jest.fn(() => 'MyCurrentBranch'),
      changeToBranch: jest.fn(),
      checkForMergeMessage: jest.fn(),
      checkForCommit: jest.fn(),
      fetchFromRemote: jest.fn(),
    };

    mockModules({
      '../merge-branches-helpers.ts': {
        ...originalModule,
        doExec: mocks.doExec,
        getCurrentBranch: mocks.getCurrentBranch,
        changeToBranch: mocks.changeToBranch,
        checkForCommit: (...args) => mocks.checkForCommit(...args),
        checkForMergeMessage: (...args) => mocks.checkForMergeMessage(...args),
        fetchFromRemote: (...args) => mocks.fetchFromRemote(...args),
      },
      '../../logger': {
        ok: mocks.ok,
        print: mocks.print,
        subtle: mocks.subtle,
        success: mocks.success,
        warn: mocks.warn,
        error: mocks.error,
      },
    });

    mergeBranches = require('../merge-branches').mergeBranches;
  });

  it('should perform shell calls to ensure branches are merged in right order', async () => {
    await mergeBranches({ branches: ['19.05.27', '19.06.10', 'master'] });
    expect(mocks.doExec.mock.calls).toEqual([
      ['git checkout 19.05.27'],
      ['git pull origin 19.05.27'],
      ['git checkout 19.06.10'],
      ['git pull origin 19.06.10'],
      ['git merge 19.05.27 --no-edit --no-ff'],
      ['git push origin 19.06.10'],
      ['git checkout master'],
      ['git pull origin master'],
      ['git merge 19.06.10 --no-edit --no-ff'],
      ['git push origin master'],
    ]);
  });

  describe('feature branches', () => {
    describe('when using feature branches option', () => {
      it('should generate the comamnds to merge the base branches into the feature branches', async () => {
        await mergeBranches({
          branches: ['19.05.27', '19.06.10', 'master'],
          featureBranches: [
            { branch: 'renewals', base: 'master' },
            { branch: 'some_feature', base: '19.06.10' },
          ],
        });

        expect(mocks.doExec.mock.calls).toMatchSnapshot();
      });
    });
  });

  describe('defaultValues', () => {
    describe('Values from config', () => {
      it('Default values in config should match the snapshot', () => {
        // this test exists only to make sure changes done to the merge-branches.config file are
        // done on purpose and that this is also visible in the code reviews at least changed in 2
        // places. Since the order of branches is something sensitive we should just make sure
        // the changes are consciously done and not by mistake.

        // to update the snapshot is super easy just run:
        //
        // ```bash
        // npm run jest-server -- -u resources/merge-branches/__tests__/merge-branches-test.js
        // ```
        const config = require('../merge-branches.config');
        expect(config).toMatchSnapshot();
      });
    });

    describe('when fetchBranches is not set', () => {
      it('should fetch from the remote to get the branches', async () => {
        await mergeBranches({ branches: ['19.05.27', '19.06.10', 'master'] });
        expect(mocks.fetchFromRemote).toHaveBeenCalledWith('origin');
      });
    });

    describe('when fetchBranches=true', () => {
      it('should fetch from the remote to get the branches', async () => {
        await mergeBranches({ branches: ['19.05.27', '19.06.10', 'master'], fetchBranches: true });
        expect(mocks.fetchFromRemote).toHaveBeenCalledWith('origin');
      });
    });

    describe('when fetchBranches=false', () => {
      it('should not fetch from the remote to get the branches', async () => {
        await mergeBranches({ branches: ['19.05.27', '19.06.10', 'master'], fetchBranches: false });
        expect(mocks.fetchFromRemote).not.toHaveBeenCalled();
      });
    });

    it('should generate the right set of commands for the default values used in the config', async () => {
      const branches = ['19.06.10', '19.07.08', '19.07.22', '19.08.05', 'master', 'renewals_feature'];
      await mergeBranches({ branches });

      const expectedCalls = [
        ['git checkout 19.06.10'],
        ['git pull origin 19.06.10'],
        ['git checkout 19.07.08'],
        ['git pull origin 19.07.08'],
        ['git merge 19.06.10 --no-edit --no-ff'],
        ['git push origin 19.07.08'],
        ['git checkout 19.07.22'],
        ['git pull origin 19.07.22'],
        ['git merge 19.07.08 --no-edit --no-ff'],
        ['git push origin 19.07.22'],
        ['git checkout 19.08.05'],
        ['git pull origin 19.08.05'],
        ['git merge 19.07.22 --no-edit --no-ff'],
        ['git push origin 19.08.05'],
        ['git checkout master'],
        ['git pull origin master'],
        ['git merge 19.08.05 --no-edit --no-ff'],
        ['git push origin master'],
        ['git checkout renewals_feature'],
        ['git pull origin renewals_feature'],
        ['git merge master --no-edit --no-ff'],
        ['git push origin renewals_feature'],
      ];

      expect(mocks.doExec.mock.calls).toEqual(expectedCalls);
    });

    it('should check for the problematic commit on every branch except master', async () => {
      const commitsToVerify = [
        {
          sha: '11150c2',
          skipFor: ['master', 'renewals_feature'],
        },
      ];

      const branches = ['19.06.10', '19.07.08', '19.07.22', '19.08.05', 'master', 'renewals_feature'];

      await mergeBranches({ branches, commitsToVerify });
      expect(mocks.checkForCommit.mock.calls).toEqual([
        [{ sha: '11150c2', branch: '19.06.10' }], // Since there is no merge on first branch, we only validate after moving to it
        [{ sha: '11150c2', branch: '19.07.08' }], // the rest of the branches are validated twice (before and after merge) except
        [{ sha: '11150c2', branch: '19.07.08' }], // from master which is not needed to be validated as the problematic commit
        [{ sha: '11150c2', branch: '19.07.22' }], // comes from it
        [{ sha: '11150c2', branch: '19.07.22' }],
        [{ sha: '11150c2', branch: '19.08.05' }],
        [{ sha: '11150c2', branch: '19.08.05' }],
      ]);
    });

    it('should check newer branches are not merged into older relase branches', async () => {
      const ignoreMergeCheckOnBranches = ['master', 'renewals_feature'];
      await mergeBranches({ branches: ['19.06.10', '19.07.08', '19.07.22', '19.08.05', 'master', 'renewals_feature'], ignoreMergeCheckOnBranches });

      // same as above, validation is done before and after the merge so each validation set is run twice per branch
      expect(mocks.checkForMergeMessage.mock.calls).toEqual([
        [{ mergeMessage: '"Merge branch \'19.07.08"', branch: '19.06.10' }],
        [{ mergeMessage: '"Merge branch \'19.07.22"', branch: '19.06.10' }],
        [{ mergeMessage: '"Merge branch \'19.08.05"', branch: '19.06.10' }],

        [{ mergeMessage: '"Merge branch \'19.07.22"', branch: '19.07.08' }],
        [{ mergeMessage: '"Merge branch \'19.08.05"', branch: '19.07.08' }],

        [{ mergeMessage: '"Merge branch \'19.07.22"', branch: '19.07.08' }],
        [{ mergeMessage: '"Merge branch \'19.08.05"', branch: '19.07.08' }],

        [{ mergeMessage: '"Merge branch \'19.08.05"', branch: '19.07.22' }],
        [{ mergeMessage: '"Merge branch \'19.08.05"', branch: '19.07.22' }],
      ]);
    });
  });

  describe('after a successful execution', () => {
    it('should request to return to the original branch', async () => {
      await mergeBranches({ branches: ['19.05.27', '19.06.10', 'master'] });
      expect(mocks.changeToBranch).toHaveBeenCalledWith('MyCurrentBranch');
    });
  });

  describe('after each merge, when validating the merge', () => {
    describe('in case we only have 3 branches', () => {
      it("should validate that merges from newer branches didn't go into older release twice per branch, before and after merge", async () => {
        await mergeBranches({ branches: ['19.05.27', '19.06.10', 'master'], ignoreMergeCheckOnBranches: ['master'] });

        // We check all the newer branches are not in the older ones, that's why there are some many checks
        // and we also do them twice per branches except for the first one where we only check once (because
        // there is no merge done for that branch there is no need to check twice) and master.
        expect(mocks.checkForMergeMessage.mock.calls).toEqual([[{ mergeMessage: '"Merge branch \'19.06.10"', branch: '19.05.27' }]]);
      });

      describe('except when pull=false and merge=false and push=false and validate=true', () => {
        it('should do validation only once per branch', async () => {
          await mergeBranches({
            push: false,
            pull: false,
            merge: false,
            validate: true,
            branches: ['19.05.27', '19.06.10', 'master'],
            ignoreMergeCheckOnBranches: ['master'],
          });
          expect(mocks.checkForMergeMessage.mock.calls).toEqual([[{ mergeMessage: '"Merge branch \'19.06.10"', branch: '19.05.27' }]]);
        });
      });
    });

    describe('when validation fails', () => {
      it('should stop executing commands', async () => {
        // This simulates the failure on the checkForMessage called after the merge of 19.05.27
        // so the last command is the merge of 19.05.27
        const failOnCallNumber = 4;
        let callNumber = 0;
        mocks.checkForMergeMessage = () => {
          callNumber++;
          if (callNumber === failOnCallNumber) throw new Error('Failed!');
        };
        await mergeBranches({ branches: ['19.05.27', '19.06.10', '19.06.24', 'master'], ignoreMergeCheckOnBranches: ['master'] });

        // since it fails validation after first merge the other commands will not be executed
        expect(mocks.doExec.mock.calls).toEqual([
          ['git checkout 19.05.27'],
          ['git pull origin 19.05.27'],
          ['git checkout 19.06.10'],
          ['git pull origin 19.06.10'],
          ['git merge 19.05.27 --no-edit --no-ff'],
        ]);
      });
    });
  });

  describe('options', () => {
    describe('when pull = false', () => {
      it('should not generate pull commands', async () => {
        await mergeBranches({ pull: false, branches: ['19.05.27', '19.06.10', 'master'] });
        expect(mocks.doExec.mock.calls).toEqual([
          ['git checkout 19.05.27'],
          ['git checkout 19.06.10'],
          ['git merge 19.05.27 --no-edit --no-ff'],
          ['git push origin 19.06.10'],
          ['git checkout master'],
          ['git merge 19.06.10 --no-edit --no-ff'],
          ['git push origin master'],
        ]);
      });
    });

    describe('when push = false', () => {
      it('should not generate push commands', async () => {
        await mergeBranches({ push: false, branches: ['19.05.27', '19.06.10', 'master'] });
        expect(mocks.doExec.mock.calls).toEqual([
          ['git checkout 19.05.27'],
          ['git pull origin 19.05.27'],
          ['git checkout 19.06.10'],
          ['git pull origin 19.06.10'],
          ['git merge 19.05.27 --no-edit --no-ff'],
          ['git checkout master'],
          ['git pull origin master'],
          ['git merge 19.06.10 --no-edit --no-ff'],
        ]);
      });
    });

    describe('when dryRun = true', () => {
      it('should not perform any shell calls', async () => {
        await mergeBranches({ dryRun: true, branches: ['19.05.27', '19.06.10', 'master'] });
        expect(mocks.doExec).toBeCalledTimes(0);
      });

      it('should print the list of commands to execute', async () => {
        await mergeBranches({ dryRun: true, branches: ['19.05.27', '19.06.10', 'master'] });
        // this one will include the list of commands
        expect(buffers.print).toMatchSnapshot();
      });

      describe('when using feature branches option', () => {
        it('should generate the commands to merge the base branches into the feature branches', async () => {
          await mergeBranches({
            dryRun: true,
            branches: ['19.05.27', '19.06.10', 'master'],
            featureBranches: [
              { branch: 'renewals', base: 'master' },
              { branch: 'some_feature', base: '19.06.10' },
            ],
          });

          expect(buffers.print).toMatchSnapshot();
        });
      });
    });
  });
});
