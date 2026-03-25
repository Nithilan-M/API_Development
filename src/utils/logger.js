const log = (...args) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}]`, ...args);
};

const error = (...args) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}]`, ...args);
};

module.exports = {
  log,
  error,
};
