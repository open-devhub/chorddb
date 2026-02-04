// Functions \\

const encoder = require("aes256");
const axios = require("axios");

// Variables \\

const dc_api = "https://discord.com/api/v10"
let token = "";
let encKey;
let channel_id = 0;

// Functions \\

function encrypt(text) {
    return encoder.encrypt(encKey, text);
}

function decrypt(text) {
    return encoder.decrypt(encKey, text);
}

function setup(tkn, enc_key, ch_id) {
    token = tkn;
    encKey = enc_key;
    channel_id = ch_id;
}

async function dc_call(url, method="GET", data=null) {
    var url = dc_api + url
    const headers = {
        Authorization: `Bot ${token}`
    }

    try {
        r = await axios({
            url,
            method,
            headers,
            data
        });

        return r.data;
    } catch(err) {
        if (err.response && err.response.data) {
            return err.response.data;
        }
    }
}

module.exports = {
    encrypt,
    decrypt,
    setup,
    dc_call
};
