import md5 from 'md5';

const apiUrl = 'https://platform.api.onesky.io/1';

function getDevHash(secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  return {
    dev_hash: md5(timestamp + secret),
    timestamp: timestamp
  };
}

function buildUrlParams(obj) {
  let str = '';
  for (let key in obj) {
    if (str !== '') {
      str += '&';
    }
    str += `${key}=${obj[key]}`;
  }

  return str;
}

function oneSkyRequest(
  fetch,
  config,
  resourcePath,
  params = {},
  method='GET',
  headers=null,
  body = null) {
  const devHash = getDevHash(config.secret);
  const urlParams = {
    api_key: config.apiKey,
    ...devHash,
    ...params
  };
  const url = `${apiUrl}${resourcePath}?${buildUrlParams(urlParams)}`;
  return fetch(url, {method, headers, body});
}

module.exports = (fetch) => (config) => {
  return {
    config: config,
    fetchLanguages() {
      const resourcePath = `/projects/${config.projectId}/languages`;
      return oneSkyRequest(fetch, config, resourcePath)
        .then(res => {
          if (res.status > 299) {
            throw new Error(`Error fetching languages: ${res.statusMessage}`);
          }
          return res.json();
        })
        .then(json => json.data);
    },
    fetchTranslations(languages, fileName) {
      const languages_ = (typeof languages == 'string') ? [languages] : languages;
      const languageFetches = languages_.map(language => {
        const params = {
          locale: language,
          source_file_name: fileName,
          export_file_name: `${language}.json`
        };
        const resourcePath = `/projects/${config.projectId}/translations`;
        return oneSkyRequest(fetch, config, resourcePath, params)
          .then(res => {
            if (res.status > 299) {
              throw new Error(`Error fetching translations: ${res.statusMessage}`);
            }
            return res.text();
          })
          .then(text => ({language, text}));
      });
      return Promise
        .all(languageFetches);
    },
    fetchAllTranslations(fileName) {
      return this.fetchLanguages()
        .then(languages => languages.map(language => language.code))
        .then(languages => this.fetchTranslations(languages, fileName));
    },
    uploadFile(content, fileName, fileFormat, options=null) {
      const resourcePath = `/projects/${config.projectId}/files`;

      const boundary = md5(Date.now());

      let multipart = `--${boundary}\n`;
      multipart += `Content-Disposition: form-data; name="file"; filename="${fileName}"\n\n`;
      multipart += content + '\n';
      multipart += `--${boundary}\n`;
      multipart += `Content-Disposition: form-data; name="file_format"\n\n`;
      multipart += fileFormat + '\n';

      if (options && (typeof options === 'object')) {
        multipart += Object.keys(options).reduce((mp, optionKey) => {
          mp += `--${boundary}\n`;
          mp += `Content-Disposition: form-data; name="${optionKey}"\n\n`;
          mp += options[optionKey] + '\n';
          return mp;
        }, multipart);
      }

      multipart += `--${boundary}--\n`;

      return oneSkyRequest(
        fetch,
        config,
        resourcePath,
        {},
        'POST',
        {'Content-Type':'multipart/form-data; boundary=' + boundary},
        multipart
      );
    }
  };
};
