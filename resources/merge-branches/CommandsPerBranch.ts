/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { ICommandsPerBranch, ICommandOptions, CommandType, ICommand } from './merge-branches-helpers';

export class CommandsPerBranch implements ICommandsPerBranch {
  commands: ICommand[] = [];

  name: string = '';

  constructor({ name = 'no named', commands = [] }: { name: string; commands: ICommand[] }) {
    this.commands = commands;
    this.name = name;
  }

  getNotExecutedCommands(opts: ICommandOptions): ICommand[] {
    const { commands } = this;
    return commands.filter((c: ICommand) => {
      const isPullCMDAndPullIsNotAllowed = c.type === CommandType.Pull && !opts.pull;
      const isMergeCMDAndMergeIsNotAllowed = c.type === CommandType.Merge && !opts.merge;
      const isPushCMDAndPushIsNotAllowed = c.type === CommandType.Push && !opts.push;
      const isValidateCMDAndValidateIsNotAllowed = c.type === CommandType.Validate && !opts.validate;
      const isValidateTaskAfterMergeAndMergeIsNotAllowed = c.type === CommandType.Validate && c.executedAt === 'afterMerge' && !opts.merge;

      if (
        isPullCMDAndPullIsNotAllowed ||
        isMergeCMDAndMergeIsNotAllowed ||
        isPushCMDAndPushIsNotAllowed ||
        isValidateCMDAndValidateIsNotAllowed ||
        isValidateTaskAfterMergeAndMergeIsNotAllowed
      ) {
        return false;
      }
      return !c.executed;
    });
  }
}
