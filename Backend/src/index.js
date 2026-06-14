import "dotenv/config";

import app from "./server.js";

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
=================================
GYM BACKEND RUNNING
PORT: ${PORT}
ENV: ${process.env.NODE_ENV}
=================================
`);
});