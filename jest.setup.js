// @ts-check
require('@testing-library/jest-dom');

// jsdom does not expose TextEncoder/TextDecoder; reuse the Node.js
// implementations so modules that encode text work under the test environment.
const { TextEncoder, TextDecoder } = require('util');

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// jsdom does not implement URL.createObjectURL; provide a stub so modules that
// reference it during tests do not throw at import time.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:mock';
}

if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}
