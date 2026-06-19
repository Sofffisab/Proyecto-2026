// src/middlewares/cache.middleware.js
import crypto from "crypto";

/**
 * Agrega Cache-Control y ETag a la respuesta.
 * El ETag se calcula sobre el body de la respuesta, permitiendo
 * responder 304 Not Modified cuando el cliente ya tiene la versión actual.
 *
 * Uso: router.get('/endpoint', authenticate, cacheResponse(60), controller.fn)
 *
 * @param {number} maxAgeSeconds - Tiempo en segundos para max-age (default: 60)
 */
export function cacheResponse(maxAgeSeconds = 60) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      const bodyString = JSON.stringify(body);
      const etag = `"${crypto.createHash("md5").update(bodyString).digest("hex")}"`;

      res.set("Cache-Control", `private, max-age=${maxAgeSeconds}`);
      res.set("ETag", etag);

      // Si el cliente envía If-None-Match y coincide, responder 304
      if (req.headers["if-none-match"] === etag) {
        return res.status(304).end();
      }

      return originalJson(body);
    };

    next();
  };
}

export default cacheResponse;