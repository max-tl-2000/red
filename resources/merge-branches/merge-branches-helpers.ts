/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import execp from '../execp';
import trim from '../../common/helpers/trim';
import execCommand from '../exec-command';

export interface ICommandOptions {
  pull: boolean;
  push: boolean;
  merge: boolean;
  validate: boolean;
}

export interface ICommitToVerify {
  sha: string;
  skipFor: string[];
}

export interface IFeatureBranchDescriptor {
  branch: string;
  base: string;
}

export interface IMergeBranchesArgs {
  remote: string;
  cmdPrefix: string;
  dryRun: boolean;
  branches: string[];
  featureBranches: IFeatureBranchDescriptor[];
  commitsToVerify: ICommitToVerify[];
  ignoreMergeCheckOnBranches: string[];
  fetchBranches: boolean;
}

export type MergeBranchesArgs = IMergeBranchesArgs & ICommandOptions;

export interface IGetValidationTasksArgs {
  branches: string[];
  currentBranch: string;
  currentBranchIndex: number;
  commitsToVerify: ICommitToVerify[];
  ignoreMergeCheckOnBranches: string[];
}

export enum CommandType {
  Checkout,
  Pull,
  Merge,
  Push,
  Validate,
}

export enum ValidationType {
  commitCheck,
  mergeMessageCheck,
}

export interface ICommand {
  cmd?: string;
  validateFn?: Function;
  description: string;
  type: CommandType;
  executed?: boolean;
  executedAt?: string;
  validationType?: ValidationType;
  validateFnArgs?: ICheckForCommitArgs | ICheckForMergeMessageArgs;
  onFailCMD?: string;
}

export interface ICommandsPerBranch {
  name: string;
  commands: ICommand[];
  getNotExecutedCommands: (opts: ICommandOptions) => ICommand[];
}

export interface ICheckForCommitArgs {
  sha: string;
  branch: string;
}

export interface ICheckForMergeMessageArgs {
  branch: string;
  mergeMessage: string;
}

export const doExec = async (cmd: string) => {
  const successExec = await execCommand(cmd);
  if (!successExec) {
    throw new Error(`Cannot execute command: ${cmd}`);
  }
};

export const getCheckForCommitCommand = (args: ICheckForCommitArgs): string => `git log | grep ${args.sha} || true`;

export const checkForCommit = async ({ sha, branch }: ICheckForCommitArgs) => {
  const res = trim(await execp(getCheckForCommitCommand({ sha, branch })));
  if (res) {
    throw new Error(`Commit "${sha}" found in branch: ${branch}`);
  }
};

export const getCheckForMergeMessageCommand = (args: ICheckForMergeMessageArgs): string => `git log | grep ${args.mergeMessage} || true`;

export const checkForMergeMessage = async ({ branch, mergeMessage }: ICheckForMergeMessageArgs) => {
  const res = trim(await execp(getCheckForMergeMessageCommand({ branch, mergeMessage })));
  if (res) {
    throw new Error(`Merge message ${mergeMessage} found in ${branch}`);
  }
};

export const getCurrentBranch = async () => trim(await execp('git rev-parse --abbrev-ref HEAD'));

export const changeToBranch = async (branch: string) => await doExec(`git checkout ${branch}`);

export const fetchFromRemote = async remote => await doExec(`git fetch ${remote}`);
