/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { generate } from 'cucumber-html-reporter';

const options = {
  theme: 'bootstrap',
  jsonFile: 'cucumber/output/cucumber_report.json',
  output: 'cucumber/output/report/cucumber_report.html',
  reportSuiteAsScenarios: true,
  launchReport: true,
};

generate(options);
