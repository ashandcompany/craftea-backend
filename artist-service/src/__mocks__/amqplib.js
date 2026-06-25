module.exports = {
  connect: () =>
    Promise.resolve({
      createChannel: () =>
        Promise.resolve({
          assertQueue: () => Promise.resolve({}),
          sendToQueue: () => {},
          close: () => Promise.resolve(),
        }),
      close: () => Promise.resolve(),
    }),
};
