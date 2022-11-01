/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// branches order from older to newer. Master should always be the lastest one
export const branchesToMerge = ['22.05.09', '22.08.30', 'master'];

// Commits that should not be on the release branches
//
// in order to check that the merge was succesful and that commits from newer release branches didn't
// get into older release branches as this is usually a sign that something weird is going on and that
// we should not push the branch we're about to push
export const commitsToVerify = [
  /*  {
    // PR that was reverted that should be in master but appeared
    // in 19.06.24 https://github.com/Redisrupt/red/pull/9177
    sha: '11150c2',
    skipFor: ['master', 'renewals_feature'],
  }, */
];

export const ignoreMergeCheckOnBranches = ['master'];

// or upstream if you have your own fork and you do the merges against upstream
export const remote = 'origin';

export const featureBranches = [
  { branch: 'feature_dashboard_improvements', base: 'master' },
  // Disabling for now as we had conflicts on merge for a long time, need to enable once merge conflicts are fixed
  // { branch: 'feature_renewals-export-mvp', base: 'master' },
];
