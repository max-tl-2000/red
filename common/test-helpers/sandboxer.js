/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

let _sinon;
let sandboxes = [];

function create() {
  // this is for when this module is used in karma
  _sinon = _sinon || global.sinon;
  const sandbox = _sinon.sandbox.create();
  sandboxes.push(sandbox);

  return sandbox;
}

function restore() {
  sandboxes.forEach(sandbox => sandbox.restore());
  sandboxes = [];
}

function setSinon(sinon) {
  _sinon = sinon;
}

export { create, restore, setSinon };
