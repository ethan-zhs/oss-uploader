/* Created by tommyZZM.OSX on 2020/9/28. */
"use strict";
import axios from 'axios';
import getSignedHeader from "./getSignedHeader.js";
import queryString from 'querystring';

export default async function (userId, jwt) {
  const params = {
    method: 'GET',
    url: 'https://test1.domain.cn:8090/newmngservice/v1/sts/uploadToken',
    params: {
      uploadType: 0,
      silent: 'true'
    }
  }
  const paramsQueryString = queryString.stringify(params.params);
  const response = await axios({
    ...params,
    headers: {
      ...getSignedHeader(params.method, params.url + '?' + paramsQueryString, ''),
      'X-USER-PK': userId,
      'Authorization': 'Bearer ' + jwt,
      Referer: 'http://test-mp.domain.cn/login',
      Origin: 'http://test-mp.domain.cn',
    }
  })

  const {
    accessKeyId,
    accessKeySecret,
    expiration,
    filenamePrefix,
    directory,
    endpoint,
    sourcePoint
  } = response.data;

  return {
    accessKeyId,
    accessKeySecret,
    expiration,
    filenamePrefix,
    directory,
    endpoint,
    sourcePoint
  };
}
