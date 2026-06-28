import crypto from "crypto";

/**
 * @param {number} maxAgeSeconds 
 */
export function cacheResponse(maxAgeSeconds = 60) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      const bodyString = JSON.stringify(body);
      const etag = `"${crypto.createHash("md5").update(bodyString).digest("hex")}"`;

      res.set("Cache-Control", `private, max-age=${maxAgeSeconds}`);
      res.set("ETag", etag);

      if (req.headers["if-none-match"] === etag) {
        return res.status(304).end();
      }

      return originalJson(body);
    };

    next();
  };
}

export default cacheResponse;