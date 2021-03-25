"use strict";
import crypto from 'crypto';
const Key = '71172577798798836911906812345678';
const Secret = '1VP0NCmPa3KoL87FLJvCdbPaIJlqHOlce2ruasdfJPadasf12ea';

const test = 'GET\nhttps://test1.domain.cn:8090/newmngservice/v1/sts/uploadToken?uploadType=0&silent=true\n1601286327843\n';

export default(method, requestUrl, bodyStream) => {
  if (typeof bodyStream != 'string' && typeof bodyStream == 'object') {
    bodyStream = JSON.stringify(bodyStream);
  }
  const Timestamp = new Date().getTime();
  let headers = {};

  let md5;
  let contentMD5 = '';

  if (bodyStream) {
    // md5 = MD5(bodyStream);
    contentMD5 = crypto.createHash('md5').update(bodyStream).digest('base64');
  }

  const stringToSigned = `${method}\n${encodeURI(requestUrl)}\n${Timestamp}\n${contentMD5}`;

  const sign = crypto.createHmac('sha256', Secret).update(stringToSigned).digest('base64');

  headers = {
    'X-Ca-Timestamp': Timestamp,
    'X-Ca-Signature': sign,
    'X-Ca-Key': Key
  };

  return headers;
};
