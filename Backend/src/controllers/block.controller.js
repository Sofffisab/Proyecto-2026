import * as blockService from "../services/block.service.js";

// GET /users/me/blocks
export async function listBlocks(req, res, next) {
  try {
    res.json({ success: true, data: await blockService.listBlocks(req.user.id) });
  } catch (err) {
    next(err);
  }
}

// POST /users/me/blocks  { name }
export async function blockByName(req, res, next) {
  try {
    const data = await blockService.blockByName(req.user.id, req.validatedData.name);
    res.status(data.alreadyBlocked ? 200 : 201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// DELETE /users/me/blocks/:blockedId
export async function unblock(req, res, next) {
  try {
    res.json({ success: true, data: await blockService.unblock(req.user.id, req.params.blockedId) });
  } catch (err) {
    next(err);
  }
}
