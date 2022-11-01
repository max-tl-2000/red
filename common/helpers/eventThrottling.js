/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/windowTime';
import 'rxjs/add/operator/toArray';
import isEqual from 'lodash/isEqual';
import uniqWith from 'lodash/uniqWith';

const isCucumberEnv = location.hostname.toLowerCase().includes('cucumber');
const defaultDuration = isCucumberEnv ? 50 : 2000;

const defaultComparer = (a, b) => {
  const equal = a.event === b.event && isEqual(a.data, b.data);
  return equal;
};

export const initThrottlerer = ({ duration = defaultDuration, comparer = defaultComparer } = {}) => {
  let generator;

  const subscription = Observable.create(o => (generator = o))
    .windowTime(duration)
    .subscribe(childObservable => childObservable.toArray().subscribe(events => uniqWith(events, comparer).forEach(({ data, handler }) => handler(data))));

  return {
    onNext: data => generator.next(data),
    dispose: () => subscription && subscription.dispose && subscription.dispose(),
  };
};
