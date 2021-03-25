/* Created by tommyZZM.OSX on 2020-2-14. */
/* eslint-disable */
import dateFormat from 'dateformat'
import CryptoJS from 'crypto-js'
// import crypto from 'crypto'
import axios from 'axios'
// import moment from 'moment'
// import SparkMD5 from 'spark-md5';
import url from 'url';

// console.log(moment === window.moment, CryptoJS === window.CryptoJS)

function dateFormatForOss (nowDate) {
  return dateFormat(nowDate, 'UTC:ddd, dd mmm yyyy HH:MM:ss \'GMT\'')
  // const format = 'ddd, DD MMM YYYY HH:MM:ss'
  // return moment(nowDate).locale('en').utcOffset(0).format(format) + ' GMT'
}

function getFileNameDefault (file, md5, ossType) {
  const pos = file.name.lastIndexOf('.')
  const now = Date.parse(new Date()) / 1000
  let suffix = ''
  if (pos !== -1) {
    suffix = file.name.substring(pos)
  }
  let _md5 = (() => {
    if (typeof md5 === 'string') {
      return md5;
    }
    if (md5 && typeof md5.string === 'string') {
      return md5.string;
    }
    return ''
  })()
  const ossTypeStrlen = (ossType || '').length || 0
  const md5Short = _md5.substr(8, 16 - ossTypeStrlen) +
      (ossType || '')
  return md5Short + now + suffix
}

// eslint-disable-next-line prefer-destructuring
// const ComposeOss = window['ComposeOss_1.0.0']; // window.ComposeOss;

async function readChunked (file, chunkSize = 1 * 1024 * 1024, chunkCallback, endCallback = () => null) {
  return new Promise((resolve) => {
    const resolveEndCallback = (error) => {
      resolve(error);
      endCallback(error);
    }

    const fileSize = file.size
    // const chunkSize = 1 * 1024 * 1024 // 4MB
    let offset = 0

    const reader = new FileReader()
    reader.onload = function () {
      if (reader.error) {
        return resolveEndCallback(reader.error || {})
      }
      offset += reader.result.byteLength
      // callback for handling read chunk
      // TODO: handle errors
      chunkCallback(reader.result, offset, fileSize)
      // console.log('offset, fileSize', reader.result)
      if (offset >= fileSize) {
        return resolveEndCallback(null)
      }
      requestAnimationFrame(() => readNext()) // 等待下一次页面渲染绘制一下，避免表现为页面卡死
    }

    reader.onerror = function (err) {
      resolveEndCallback(err || {})
    }

    function readNext () {
      const fileSlice = file.slice(offset, offset + chunkSize)
      reader.readAsArrayBuffer(fileSlice)
    }

    readNext()
  })
}

// https://bugjia.net/200227/424180.html
function arrayBufferToWordArray (ab) {
  const i8a = new Uint8Array(ab)
  const a = []
  for (let i = 0; i < i8a.length; i += 4) {
    a.push(i8a[i] << 24 | i8a[i + 1] << 16 | i8a[i + 2] << 8 | i8a[i + 3])
  }
  return CryptoJS.lib.WordArray.create(a, i8a.length)
}

export async function getMD5 (blob, chunkSize = 1 * 1024 * 1024) {
  return new Promise(async (resolve, reject) => {
    const md5CryptoJS = CryptoJS.algo.MD5.create()
    const md5HexCryptoJS = CryptoJS.algo.MD5.create()
    // const md5 = crypto.createHash('md5')
    // const md5Hex = crypto.createHash('md5')
    await readChunked(blob, chunkSize, (chunk, offs, total) => {
      md5CryptoJS.update(arrayBufferToWordArray(Buffer.from(chunk, 'utf8')))
      md5HexCryptoJS.update(arrayBufferToWordArray(Buffer.from(chunk, 'utf8')))
      // md5.update(Buffer.from(chunk, 'utf8'))
      // md5Hex.update(Buffer.from(chunk, 'utf8'))
      // if (cbProgress) {
      //     cbProgress(offs / total)
      // }
    }, err => {
      if (err) {
        reject(err)
      } else {
        const hashCryptoJS = md5CryptoJS.finalize()
        // const toResolveNode = { string: md5Hex.digest('hex'), base64: md5.digest('base64') }
        const toResolveCryptoJS = {
          string: hashCryptoJS.toString(CryptoJS.enc.Hex),
          base64: hashCryptoJS.toString(CryptoJS.enc.Base64)
        }
        // console.log('using toResolveCryptoJS', toResolveNode, toResolveCryptoJS)
        resolve(toResolveCryptoJS)
      }
    })
  })
}

function signature (stringToSign, token) {
  // eslint-disable-next-line no-shadow
  // let sign = crypto.createHmac('sha1', token.AccessKeySecret)
  // sign = sign.update(Buffer.from(stringToSign, 'utf8')).digest('base64')

  const hash = CryptoJS.HmacSHA1(stringToSign, token.AccessKeySecret)

  // console.log(sign, hash.toString(CryptoJS.enc.Base64))

  return hash.toString(CryptoJS.enc.Base64)
}

function authorization (method, resource, subres, headers, token) {
  const ossHeaders = {}
  for (const key in headers) {
    const lkey = key.toLowerCase().trim()
    if (lkey.indexOf('x-oss-') === 0) {
      ossHeaders[lkey] = ossHeaders[lkey] || []
      ossHeaders[lkey].push(String(headers[key]).trim())
    }
  }

  const ossHeadersList = []
  Object.keys(ossHeaders).sort().forEach(function (key) {
    ossHeadersList.push(key + ':' + ossHeaders[key].join(','))
  })
  const params = [
    method.toUpperCase(),
    headers['Content-Md5'] || '',
    headers['Content-Type'] || '',
    headers['x-oss-date'],
    ...ossHeadersList
  ]
  let resourceStr = ''
  resourceStr += resource

  const subresList = []
  if (subres) {
    if (typeof subres === 'string') {
      subresList.push(subres)
    } else {
      for (const k in subres) {
        const item = subres[k] ? k + '=' + subres[k] : k
        subresList.push(item)
      }
    }
  }

  if (subresList.length > 0) {
    resourceStr += '?' + subresList.join('&')
  }
  params.push(resourceStr)
  const stringToSign = params.join('\n')
  const auth = 'OSS ' + token.AccessKeyId + ':'
  // console.log('stringToSign', stringToSign)
  return auth + signature(stringToSign, token)
}

function getHeaders (options, nowDate = new Date().getTime()) {
  const md5 = options.md5;
  const token = options.token;
  const headers = {
    'x-oss-date': dateFormatForOss(nowDate)
  }
  headers['Content-Type'] = options.mime || null
  if (token.SecurityToken) {
    headers['x-oss-security-token'] = token.SecurityToken
  }
  if (options.content) {
    headers['Content-Md5'] = md5
  }
  if (!token.bucket) {
    throw new Error('token.bucket not exists!')
  }
  const authResource = `/${token.bucket}/${options.object || ''}`
  headers.authorization = authorization(options.method, authResource, options.subres, headers, token)
  return headers
}

function getWithHeaders(requestUrl, options, nowDate = new Date().getTime(), headersPatch = null) {
  const parsedRequestUrl = url.parse(requestUrl);
  return {
    url: requestUrl,
    headers: {
      ...getHeaders({ ...options, subres: parsedRequestUrl.query }, nowDate),
      ...headersPatch
    }
  }
}

function getUrlDefault (options, token) {
  let resourceStr = ''
  const subresList = []
  if (options.subres) {
    if (typeof options.subres === 'string') {
      subresList.push(options.subres)
    } else {
      // eslint-disable-next-line guard-for-in,no-restricted-syntax
      for (const k in options.subres) {
        const item = options.subres[k] ? k + '=' + options.subres[k] : k
        subresList.push(item)
      }
    }
  }
  if (subresList.length > 0) {
    resourceStr += '?' + subresList.join('&')
  }
  // eslint-disable-next-line no-useless-concat
  return 'https://' + token.bucket + '.' + token.region + '.aliyuncs.com' + '/' + options.object + resourceStr
}

function calculateWithRequestSpeed (fn) {
  let timeCurrent = Date.now()
  let timeDelta = 0;
  let loadedLast = 0;
  let loadedDelta = 0;
  let speed = 0;
  return function (progressEvent) {
    timeDelta = timeDelta + (Date.now() - timeCurrent);
    loadedDelta = loadedDelta + (progressEvent.loaded - loadedLast);

    if (speed === 0) {
      speed = loadedDelta / (timeDelta / 1000)
    }

    if (timeDelta > 1000 && loadedDelta > 0) {
      speed = loadedDelta / (timeDelta / 1000)
      loadedDelta = 0;
      timeDelta = 0;
    }

    fn(progressEvent, speed)

    loadedLast = progressEvent.loaded;
    timeCurrent = Date.now();
  }
}

// --- 上传形式

// 阿里云单次上传
async function createTaskStandalone(requestUrl, params, optionsCallback = {}) {
  const {
    onProgress = () => null,
    headersPatch = null
  } = optionsCallback;

  const requestData = {
    url: requestUrl,
    method: 'PUT',
    headers: {
      ...getHeaders(params, Date.now()),
      ...headersPatch
    }
  }

  let cancel = () => {
    throw new Error('not canceled')
  }

  const cancelToken = new axios.CancelToken((thatCancel) => {
    cancel = thatCancel
  });

  // eslint-disable-next-line no-shadow
  const task = axios({
    method: requestData.method,
    url: requestData.url,
    headers: {
      accept: '*/*',
      ...requestData.headers
    },
    data: params.file,
    onUploadProgress: calculateWithRequestSpeed(function (progressEvent, speed) {
      // Do whatever you want with the native progress event
      const percent = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
      )
      onProgress({ speed, progress: percent })
    }),
    // NOTICE: 此处获得axios提供的取消方法，可以取消上传请求
    // eslint-disable-next-line no-shadow
    cancelToken
  })

  return [task, () => cancel()]
}

// 阿里云分片上传
async function createTaskMultipart(requestUrl, params, optionsCallback = {}) {
  const {
    chunkSize = 1024 * 1024, // 1MB
    onProgress = () => null,
    onCheckPoint = () => null, // 用于支持断点续传，必须自行保存checkPoint的uploadId
    getCheckPoint = () => null, // 用于断点续传，获取uploadId,
    headersPatch = null
  } = optionsCallback;

  let cancelRequest = () => {
    throw new Error('not canceled')
  }

  let isWasCancel = false;

  const cancel = () => {
    isWasCancel = true;
    cancelRequest()
  }

  // init
  async function task() {
    const withUploadId = await (async function () {
      const withUploadIdLast = await getCheckPoint({ ...params });

      if (Array.isArray(withUploadIdLast) && withUploadIdLast.length >= 3) {
        return withUploadIdLast;
      }

      const uploadPost = (config) => {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('post', config.url);
          Object.keys(config.headers).forEach(key => {
            xhr.setRequestHeader(key, config.headers[key]);
          })
          xhr.onreadystatechange = function(){
            const XMLHttpReq = xhr;
            if (XMLHttpReq.readyState === 4) {
              if (XMLHttpReq.status === 200) {
                const data = XMLHttpReq.responseText;
                resolve({ data })
              } else {
                reject(XMLHttpReq.responseText)
              }
            }
          };
          xhr.send(config.body);
        })
      }

      const responseHEAD = await uploadPost({
        method: 'POST',
        ...getWithHeaders(
            `${requestUrl}?uploads`,
            { ...params, method: 'POST', content: null },
            Date.now(),
            { ...headersPatch }
        ),
        body: {}
      });

      const [_, uploadIdResult] =
          /<UploadId>([\w\d]+)<\/UploadId>/.exec(responseHEAD.data);

      return [uploadIdResult, 0, []];
    })()

    if (isWasCancel) return false;

    const [uploadId, _, checkPointDoneEtags] = withUploadId

    let [__, current] = withUploadId;

    const totalSize = params.file.size;

    const total = Math.ceil(params.file.size / chunkSize)

    // const checkPointDoneEtags = [];

    // await onCheckPoint(uploadId, current, total, chunkSize, checkPointDoneEtags);

    while (current < total) {
      if (isWasCancel) return;

      let fileDataFragment = params.file.slice(chunkSize * current, chunkSize * (current + 1)) ;

      const response = await axios({
        method: 'PUT',
        ...getWithHeaders(
            `${requestUrl}?partNumber=${current + 1}&uploadId=${uploadId}`,
            { ...params, method: 'PUT', content: null },
            Date.now(),
            { ...headersPatch }
        ),
        data: fileDataFragment,
        onUploadProgress: calculateWithRequestSpeed(function (progressEvent, speed) {
          onProgress({
            speed,
            progress: Math.round(((chunkSize * current + progressEvent.loaded) / totalSize) * 100)
          })
        }),
        // eslint-disable-next-line no-shadow
        cancelToken: new axios.CancelToken((thatCancel) => {
          cancelRequest = thatCancel
        })
      })

      const etag = await (async function () {
        const etagFromResponse = response.headers.etag;
        if (etagFromResponse) {
          return etagFromResponse;
        }
        const { string: etagLocal } = await getMD5(fileDataFragment);
        return JSON.stringify(etagLocal.toUpperCase());
      })();

      checkPointDoneEtags.push(etag);

      current = current + 1;

      // await onProgress({ progress: Math.round((current / total) * 100) })

      await onCheckPoint(
          { ...params },
          uploadId,
          current,
          total,
          checkPointDoneEtags,
          chunkSize
      );
    }

    if (isWasCancel) return false;

    // console.log('checkPointDoneEtags', checkPointDoneEtags)

    const xmlParts = checkPointDoneEtags.map((etag, i) => (
        '<Part>\n' +
        '<PartNumber>' + (i + 1) + '</PartNumber>\n' +
        '<ETag>' + etag + '</ETag>\n' +
        '</Part>\n'
    ));

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<CompleteMultipartUpload>\n'
        + xmlParts.join('')
        + '</CompleteMultipartUpload>'
    ;

    const responseEND = await axios({
      method: 'POST',
      ...getWithHeaders(
          `${requestUrl}?uploadId=${uploadId}`,
          { ...params, method: 'POST', mime: 'application/xml', content: null },
          Date.now(),
          { ...headersPatch }
      ),
      data: xml,
      cancelToken: new axios.CancelToken((thatCancel) => {
        cancelRequest = thatCancel
      })
    });

    return true;
  }

  return [task(), () => cancel()];
}

// ---

export default function createSimpleUploaderAliCloudOss (host, token, options) {
  const {
    // progress = () => null,
    getUrl = getUrlDefault,
    getFileName = (file, fileMd5String) => getFileNameDefault(file, fileMd5String),
    getFilePathName = fileName => fileName,
    getFileMime = () => 'application/octet-stream',
    getFileMd5 = async (file, chunkSize) => await getMD5(file, chunkSize),
  } = options

  const byPassMd5 = fileMd5 => fileMd5 ? fileMd5 : null

  return async function upload (file, optionsCallback) {
    const {
      chunkSize: chunkSizeOption = 1024 * 1024,
      // onProgress = () => null
    } = optionsCallback;

    const chunkSize = Math.max(Math.min(5 * 1024 * 1024, chunkSizeOption), 32 * 1024);

    // ----->
    // NOTICE: 此处需要通过分片读取的方式计算文件md5，避免文件过大导致浏览器内存泄漏崩溃
    const fileMd5 = byPassMd5(await getFileMd5(file, chunkSize));

    const fileName = getFileName(file, fileMd5);

    const filePathName = getFilePathName(fileName, token);

    const fileMime = getFileMime(file.name) || 'application/x-www-form-urlencoded';

    // console.log('filePathName', filePathName)

    const params = {
      object: filePathName,
      method: 'PUT',
      file: file,
      mime: fileMime,
      content: false,
      md5: fileMd5,
      token
    };

    const requestUrl = getUrl(params, token);

    const [task, cancel] = await (async function () {
      // throw console.log(file);
      if (file.size > chunkSize) {
        return createTaskMultipart(requestUrl, params, optionsCallback)
      }
      return createTaskStandalone(requestUrl, params, optionsCallback)
    })();

    let isWasAbort = false;

    let abort = () => { isWasAbort = true }

    const taskCancelable = new Promise((resolve, reject) => {
      const rejectRequest = abort = () => {
        // console.log('requestAborted', requestData.url);
        try {
          cancel()
        } finally {
          reject(Object.assign(new Error('aborted'), {
            isAborted: true
          }))
        }
      };
      task.then(() => {
        if (isWasAbort) { return rejectRequest() }
        return resolve({
          fileName,
          name: fileName,
          sourceLink: `${host}/${params.object}`
        })
      }).catch(reject)
    })

    // eslint-disable-next-line no-unreachable
    return {
      abort: () => abort(),
      promise: () => taskCancelable
    }
  }
}
