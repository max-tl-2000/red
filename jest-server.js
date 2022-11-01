/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const includeAllFilesInCoverage = process.env.INCLUDE_ALL_FILES_IN_COVERAGE === 'true' || process.env.CONTINUOUS_INTEGRATION === 'true';

const config = {
  bail: true,
  setupFiles: ['<rootDir>/resources/jest/setup-node-env.js'],
  setupFilesAfterEnv: ['<rootDir>/resources/jest/before-server-tests.js'],
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'node', 'ts'],
  moduleNameMapper: {
    '^.+\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/resources/jest/FileStub.js',
    '^.+\\.(css|scss)$': '<rootDir>/resources/jest/CSSStub.js',
  },
  roots: [
    '<rootDir>/common/server/',
    '<rootDir>/cucumber/',
    '<rootDir>/server/',
    '<rootDir>/aws/lambdas/',
    '<rootDir>/auth/server/',
    '<rootDir>/rentapp/server/',
    '<rootDir>/resources/',
    '<rootDir>/resident/',
  ],
  moduleDirectories: ['node_modules', 'common', 'client'],
  testPathIgnorePatterns: [
    '/fixtures/',
    '<rootDir>/(static|docker|logs|docs|node_modules)/',
    '<rootDir>/(node_cache|node_shrinkwrap|scripts|uploads|.cache)/',
    '<rootDir>/rentapp/static/',
    '<rootDir>/auth/static/',
  ],
  testRegex: '/__(tests|specs)__/.*.([\\.test\\.spec])\\.(j|t)s$',
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage/server',
  coverageReporters: ['lcov', 'json-summary'],
};

if (includeAllFilesInCoverage) {
  config.collectCoverageFrom = [
    '**/*.js',
    '!**/__integration__/**',
    '!**/__specs__/**',
    '!**/__tests__/**',
    '!**/migrations/**',
    '!**/test-helpers/**',
    '!**/resources/{jest,data,webpack,bin,bnr,svgs,generated-routes}/**',
  ];
}

module.exports = config;
