// Errors \\

class MessageTooLargeError extends Error {
  constructor(length, maxLength) {
    super(`Message too large (${length} > ${maxLength})`);
    this.name = "MessageTooLargeError";
    this.length = length;
    this.maxLength = maxLength;
  }
}

class InvalidTokenError extends Error {
  constructor() {
    super("Invalid Token");
    this.name = "InvalidTokenError";
  }
}

class InvalidChannelIdError extends Error {
  constructor() {
    super("Invalid Channel Id");
    this.name = "InvalidChannelIdError";
  }
}

class ChordDBNotStartedError extends Error {
  constructor() {
    super("ChordDB not started");
    this.name = "ChordDBNotStartedError";
  }
}

module.exports = {
  MessageTooLargeError,
  InvalidChannelIdError,
  InvalidTokenError,
  ChordDBNotStartedError,
};
