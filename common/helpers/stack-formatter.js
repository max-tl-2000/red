/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const formatStack = stack => {
  const stringsForDeletion = ['(native)', 'node_modules', 'next_tick'];
  if (!stack) return '[NO STACK PROVIDED]';
  return (
    stack &&
    stack
      .split('\n')
      .filter(line => !stringsForDeletion.some(string => line.indexOf(string) >= 0))
      .join('\n')
  );
};
