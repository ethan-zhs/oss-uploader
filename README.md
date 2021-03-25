# simple-uploader

优化的地方：
- (0) 只包括PUT请求相关的代码，参数传入浏览器`file`对象，**不包括其他DOM操作**
- (1）能够取消请求（旧版无法取消）
- (2）直传超过数百M文件的时候不会崩溃（旧版有可能会出现崩溃）
- (3) 上传时可以通过参数配置直接上传路径文件名等信息



##### .npmrc

`npm install simple-uploader`

### !!! 以下代码都只是例子，不要直接拷贝使用，具体的文件名自行根据业务拼接 !!!

```javascript
import createOssUploader from 'simple-uploader'

async function uploadFile ({ commit }, payload) {
  const { file } = ensureObject(payload)

  const withToken = await getUploadTokenApi()

  const position = withToken.imagePosition

  const upload = await createOssUploader(position.visitHost, {
    ...withToken,
    bucket: withToken?.imagePosition?.bucketName,
    AccessKeyId: withToken?.accessKeyId,
    AccessKeySecret: withToken?.accessKeySecret,
    SecurityToken: withToken?.securityToken
  }, {
    getFileMime: mime.getType, // 上传文件的type, 会保存在CDN上
    getFilePathName: (fileName) => { // 上传相对路径，不要把域名传到这
      return position.directory + withToken.filenamePrefix + '-' + fileName
    },
    getUrl: (params, token) => { // 上传接口，阿里云的域名+文件路径
      const uploadPoint = 'https://' + withToken.endpoint.replace(/^https?:\/\//, `${token.bucket}.`)
      return uploadPoint + '/' + params.object
    }
  })

  const uploading = await upload(file.file || file, {
    headersPatch: {}, // 添加特殊的header
    onProgress: ({ progress }) => {}, // 上传进到，百分比数字
    onCheckPoint: ({ file, md5 }, uploadId, index, total, checkPointDoneEtags) => {}, 
    // 断点续传，保存断点，例如 file.name + md5 作为 key 保存 uploadId, index，支持Promise或async function
    getCheckPoint: ({ file, md5 }) => ([uploadId, index, checkPointDoneEtags])
    // 断点续传，读取断点，返回数据 [uploadId, index]，支持Promise或async function
  })

  // uploading.promise() 上传过程的promise
  // uploading.cancel() 取消上传
 
  const { name, sourceLink } = await uploading.promise()

  return { name, sourceLink }
}
```
