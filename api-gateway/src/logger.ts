export const logger = {
  info: (msg: string) => console.log(`[${new Date().toISOString()}] INFO  ${msg}`),
  error: (msg: string) => console.error(`[${new Date().toISOString()}] ERROR ${msg}`),
};
