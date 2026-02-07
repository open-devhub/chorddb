// Functions \\

const encoder = require("aes256");
const axios = require("axios");

const dc_api = "https://discord.com/api/v10";
let token = "";
let encKey = "";

// Functions \\

function encrypt(text) {
  return encoder.encrypt(encKey, text);
}

function decrypt(text) {
  return encoder.decrypt(encKey, text);
}

function setup(tkn, enc_key) {
  token = tkn;
  encKey = enc_key;
  return true;
}

async function dc_call(url, method = "GET", data = null) {
  const fullUrl = dc_api + url;
  const headers = {
    Authorization: `Bot ${token}`,
  };

  try {
    const r = await axios({
      url: fullUrl,
      method,
      headers,
      data,
    });
    return r.data;
  } catch (err) {
    if (err.response && err.response.data) {
      return err.response.data;
    }
    throw err;
  }
}

module.exports = {
  encrypt,
  decrypt,
  setup,
  dc_call,
};
