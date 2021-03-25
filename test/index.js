/* Created by tommyZZM.OSX on 2020/9/28. */
"use strict";
import reqLoginTestAccount from './_itouchtv-test-ctx/reqLoginTestAccount.js';
import reqGetUploadToken from "./_itouchtv-test-ctx/reqGetUploadToken.js";

describe('itouchtv@simple-uploader', function () {
  // utiltest
  // Utiltest123
  const context = {};

  before(async function() {
    const data = await reqLoginTestAccount('utiltest', 'Utiltest123')
    context.id = data.id;
    context.jwt = data.jwt;
    console.log(data);
    // runs before all tests in this file regardless where this line is defined.
  });

  it('basic', async function () {
    const res = await reqGetUploadToken(context.id, context.jwt);
    console.log('basic', res);
  })
})
