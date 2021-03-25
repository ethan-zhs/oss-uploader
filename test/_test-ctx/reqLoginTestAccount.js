/* Created by tommyZZM.OSX on 2020/9/28. */
"use strict";
import axios from 'axios';
import getSignedHeader from "./getSignedHeader.js";

export default async function reqLoginTestAccount(account, password) {
  const params = {
    method: 'POST',
    url: 'https://test1.domain.cn:8090/newmngservice/v2/login',
    data: {
      account,
      password,
      validateCode: "123123"
    }
  }
  const response = await axios({
    ...params,
    headers: {
      ...getSignedHeader(params.method, params.url, params.data),
      Referer: 'http://test-mp.domain.cn/login',
      Origin: 'http://test-mp.domain.cn',
    }
  });

  return {
    id: response.data.id,
    jwt: response.data.jwt
  };
}
