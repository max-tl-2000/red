/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { write, glob } from '../common/helpers/xfs';
import { subtle, ok } from './logger';

const fileTemplate = `
/* AUTO GENERATED CODE PLEASED DO NOT MODIFY DIRECTLY!!!!! */

import React from 'react';
import Router from 'react-router/lib/Router';
import RootDemo from 'ComponentsDemo/RootDemo/RootDemo';
import NotFound from 'ComponentsDemo/NotFound/NotFound';
[IMPORTS]

const routes = {
  path: '/components-demo/',
  component: RootDemo,
  childRoutes: [
    [ROUTES]
    { path: '*', component: NotFound },
  ],
};

export default function demoRoutes(history) {
  return <Router routes={ routes } history={ history } />;
}
`;

const createRoutes = async ({ quiet = true } = {}) => {
  const matches = await glob('./client/ComponentsDemo/**/*Demo.js');

  if (matches.length > 0) {
    !quiet &&
      subtle(`found demo modules

    - ${matches.join('\n    - ')}
   `);
  } else {
    throw new Error('No error modules found');
  }

  const replacements = matches
    .filter(file => !file.match(/RootDemo/))
    .map(file => {
      const modulePath = file.replace('./client/', '../.$&').replace(/\.js$/g, '');
      const moduleName = path.basename(modulePath);
      const title = moduleName.replace(/Demo$/, '');
      const routePath = title.toLowerCase();

      return {
        title,
        modulePath,
        moduleName,
        routePath,
      };
    })
    .reduce(
      (seq, { moduleName, modulePath, title, routePath }) => {
        seq.imports.push(`import ${moduleName} from '${modulePath}';`);
        seq.routeComponents.push(`   { path: '${routePath}', title: '${title}', component: ${moduleName} },`);
        return seq;
      },
      { imports: [], routeComponents: [] },
    );

  const content = fileTemplate.replace(/\[IMPORTS]/, replacements.imports.join('\n')).replace(/\[ROUTES]/, replacements.routeComponents.join('\n'));

  await write('./resources/generated-routes/index.js', content);

  ok('Demo routes generated!');
};

createRoutes();
