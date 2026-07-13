import crypto from "crypto";

// Adds Cache-Control + ETag headers, replying 304 on a matching If-None-Match.
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