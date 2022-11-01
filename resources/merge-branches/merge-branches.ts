/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { error, subtle, ok, success, warn, print } from '../logger';
import envVal from '../../common/helpers/env-val';
import {
  ICommandsPerBranch,
  ICommandOptions,
  CommandType,
  ICommand,
  MergeBranchesArgs,
  ICommitToVerify,
  getCurrentBranch,
  checkForCommit,
  checkForMergeMessage,
  doExec,
  IGetValidationTasksArgs,
  changeToBranch,
  ValidationType,
  getCheckForMergeMessageCommand,
  getCheckForCommitCommand,
  ICheckForCommitArgs,
  ICheckForMergeMessageArgs,
  fetchFromRemote,
} from './merge-branches-helpers';

import { CommandsPerBranch } from './CommandsPerBranch';

const getValidationTasks = ({
  commitsToVerify,
  branches,
  currentBranch,
  currentBranchIndex,
  ignoreMergeCheckOnBranches,
}: IGetValidationTasksArgs): ICommand[] => {
  const nextIndex = currentBranchIndex + 1;
  const commands: ICommand[] = [];
  const restOfBranches = branches.slice(nextIndex);

  commitsToVerify.forEach((commitToVerify: ICommitToVerify) => {
    const { sha, skipFor = [] } = commitToVerify;
    if (!sha || skipFor.includes(currentBranch)) return;

    commands.push({
      description: `Checking if commit ${sha} is not in the branch ${currentBranch}`,
      type: CommandType.Validate,
      validationType: ValidationType.commitCheck,
      validateFnArgs: { sha, branch: currentBranch },
      validateFn: async () => {
        await checkForCommit({ sha, branch: currentBranch });
        // when the check fails it throws so if that doesn't happen that means everything is fine
        ok(`Problematic commit: "${sha}" not found in "${currentBranch}". All Good!`);
      },
    });
  });

  // verify commits from newer release branches didn't go into older release branches by checking the merge messages
  restOfBranches
    .filter(b => !ignoreMergeCheckOnBranches.includes(b))
    .forEach(nextBranch => {
      const mergeMessage = `"Merge branch '${nextBranch}"`;
      commands.push({
        description: `Checking if '${nextBranch}' release branch is not included in '${currentBranch}' release branch`,
        type: CommandType.Validate,
        validationType: ValidationType.mergeMessageCheck,
        validateFnArgs: { mergeMessage, branch: currentBranch },
        validateFn: async () => {
          await checkForMergeMessage({ mergeMessage, branch: currentBranch });
          // when the check fails it throws so if that doesn't happen that means everything is fine
          ok(`Problematic mergeMessage: "${mergeMessage}" not found in "${currentBranch}". All Good!`);
        },
      });
    });

  return commands;
};

export const getCommandsToExecutePerBranch = (branches: string[], remote: string, commitsToVerify: ICommitToVerify[], ignoreMergeCheckOnBranches: string[]) =>
  branches.reduce((acc: ICommandsPerBranch[], branch, index) => {
    const prevIndex = index - 1;
    const prevBranch = prevIndex >= 0 ? branches[prevIndex] : undefined;

    const commands: ICommand[] = [
      {
        cmd: `git checkout ${branch}`,
        onFailCMD: `git checkout -b ${branch} --track ${remote}/${branch}`,
        description: `Checkout branch ${branch}`,
        type: CommandType.Checkout,
      },
      { cmd: `git pull ${remote} ${branch}`, description: `Pulling from ${remote}/${branch}`, type: CommandType.Pull },
    ];

    const validateTasks = getValidationTasks({ commitsToVerify, branches, currentBranch: branch, currentBranchIndex: index, ignoreMergeCheckOnBranches });

    commands.push(...validateTasks);

    if (prevBranch) {
      commands.push({ cmd: `git merge ${prevBranch} --no-edit --no-ff`, description: `Merging ${prevBranch} into ${branch}`, type: CommandType.Merge });
      commands.push(...validateTasks.map(t => ({ ...t, executedAt: 'afterMerge' })));
      commands.push({ cmd: `git push ${remote} ${branch}`, description: `Push ${branch} to ${remote}`, type: CommandType.Push });
    }

    acc.push(
      new CommandsPerBranch({
        name: `commands for branch ${branch}`,
        commands,
      }),
    );
    return acc;
  }, []);

const getCommand = (args: ICommand, cmdPrefix: string, addComment: boolean = false): string => {
  let { cmd } = args;

  if (args.type === CommandType.Validate) {
    if (args.validationType === ValidationType.commitCheck) {
      cmd = getCheckForCommitCommand(args.validateFnArgs as ICheckForCommitArgs);
    }
    if (args.validationType === ValidationType.mergeMessageCheck) {
      cmd = getCheckForMergeMessageCommand(args.validateFnArgs as ICheckForMergeMessageArgs);
    }
  }

  if (addComment) {
    cmd = `\n# ${args.description}\n${cmd}`;
  }

  return (cmdPrefix ? `${cmdPrefix}${cmd}` : cmd) as string;
};

const printCommandsNotYetExecuted = (commandsPerBranch: ICommandsPerBranch[], cmdPrefix, options: ICommandOptions) => {
  const allMissingCommands = commandsPerBranch.reduce((acc: ICommand[], cPerBranch) => {
    acc = acc.concat(cPerBranch.getNotExecutedCommands(options));
    return acc;
  }, []);

  print(allMissingCommands.map(c => getCommand(c, cmdPrefix, true)).join('\n'), '\n');
};

const processBranchCommands = (cmds: ICommand[] = []) =>
  cmds.reduce(
    (acc, command: ICommand): Promise<void> =>
      acc.then(async () => {
        const { cmd, description, validateFn, onFailCMD } = command;

        subtle('Executing', description);

        if (typeof validateFn === 'function') {
          await validateFn();
          command.executed = true;
          return;
        }

        try {
          await doExec(cmd as string);
        } catch (err) {
          if (onFailCMD) {
            await doExec(onFailCMD);
          } else {
            throw err;
          }
        }
        command.executed = true;
        ok('executed:', cmd);
      }),
    Promise.resolve(),
  );

const processCommands = async (commandsPerBranch: ICommandsPerBranch[], options: ICommandOptions) => {
  await commandsPerBranch.reduce(
    (acc, descriptor: ICommandsPerBranch): Promise<void> =>
      acc.then(() => {
        subtle('Executing', descriptor.name);
        return processBranchCommands(descriptor.getNotExecutedCommands(options));
      }),
    Promise.resolve(),
  );
};

/**
 * Merge the branches from older to newer release branches as especified in the branches parameter
 *
 * @param args
 * @param args.dryRun do not actually execute the commands just list them. Useful to get a list of
 * commands to be executed manually. Default false
 * @param args.pull whether to pull or not from the remote after changing branches. Default true
 * @param args.push whether to push to the remote after a successful merge of an older release
 * branch into a newer release branch. This will only be honored if merge is true. Otherwise this
 * will be assumed to be always false. Default true
 * @param args.merge whether or not to perform a merge of the older branch into the newer branch.
 * Default true
 * @param args.validate whether or not to execute the validations after merge. This is useful to
 * check we're not merging stuff that not be in a given release branch. Like checking for a known
 * commit in master that should not be in any release branch yet. Default true
 * @param args.fetchBranches whether to fetch from the remote the branches info at the beginning
 * of the execution of the script
 * @param args.remote which remote to use as some people use `origin` directly or `upstream` when
 * they have forked the repo
 * @param args.cmdPrefix whether to add a prefix for each command that is printed when dryRun is
 * set to true. Useful to copy these commands to a shell like xsh which require commands to be
 * prefixed with `$` in order to be recognized as commands
 * @param args.branches the branches to consider when performing the merge. They should be sorted out
 * from older to newer release branches. Master should always be the last one.
 * @param args.commitsToVerify an array of ICommitsToVerify with `sha` and `skipFor` properties
 * @param args.commitsToVerify[].sha the commit sha id
 * @param args.commitsToVerify[].skipFor branches where the check won't be performed
 * @param args.ignoreMergeCheckOnBranches (string[])  branches where the check for merge messages will be
 * skipped/ignored
 *
 */
export const mergeBranches = async (args: MergeBranchesArgs): Promise<void> => {
  const {
    dryRun = false,
    pull = true,
    push = true,
    merge = true,
    validate = true,
    remote = 'origin',
    fetchBranches = true,
    cmdPrefix = '',
    branches,
    commitsToVerify = [],
    ignoreMergeCheckOnBranches = [],
    featureBranches = [],
  }: MergeBranchesArgs = args;

  // it is important to store the current branch to return to it if everything went just well
  const startingBranch = await getCurrentBranch();

  if (fetchBranches) {
    // it is important to fetch from the repo so checkout branches will work
    await fetchFromRemote(remote);
  }

  subtle('Current branch', startingBranch);
  subtle('options', { dryRun, pull, merge, push, remote, validate, cmdPrefix, branches, featureBranches });

  let commandsPerBranch = getCommandsToExecutePerBranch(branches, remote, commitsToVerify, ignoreMergeCheckOnBranches);

  featureBranches.forEach(featureBranch => {
    const { branch, base } = featureBranch;
    commandsPerBranch = [...commandsPerBranch, ...getCommandsToExecutePerBranch([base, branch], remote, [], [])];
  });

  const theOptions = { pull, merge, push: push && merge, validate };

  try {
    if (dryRun) {
      print('\n');
      warn('DRYRUN ENABLED. Just printing the commands that will be executed. Nothing is modified\n\n');
      printCommandsNotYetExecuted(commandsPerBranch, cmdPrefix, theOptions);
      return;
    }
    await processCommands(commandsPerBranch, theOptions);
    if (!dryRun) {
      await changeToBranch(startingBranch);
      ok(`Moved back to ${startingBranch}`);
    }
    success('All branches merged without errors');
  } catch (err) {
    warn('====================== ATTENTION MERGE BRANCHES FAILED ========================');
    warn(' Automatic merges failed. This might be due to a conflict in the branches, a');
    warn(' validation check that failed or other reasons. In any case the repo is likely');
    warn(' dirty. Run `git status` to check before attempt to run the script again');
    warn('===============================================================================');

    print('');
    warn('The following commands were not executed.');
    warn('They need to be executed MANUALLY to complete the merge of the branches!!!\n');

    printCommandsNotYetExecuted(commandsPerBranch, cmdPrefix, theOptions);

    warn('If the command that failed was a merge command, it might be due to a conflict!');
    warn('please check that git repo is ok before attempt to execute the command again\n');

    error('Merge branches error', err);

    // this check is here so the tests don't fail, the script will exit with
    // an error code only if the CI_MERGE_BRANCHES environment variable is set
    if (envVal('CI_MERGE_BRANCHES', false)) {
      throw new Error();
    }
  }
};
