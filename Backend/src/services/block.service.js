// "Bloquear persona x" (Settings > interacciones sociales).
//
// The member types a NAME (there is no list to pick from). The name is matched
// against the full name of active members, ignoring case, accents and word
// order. If it matches nobody -> 404; if it matches several people we refuse
// (409) rather than guess and block the wrong one.
//
// A block is mutual for matching purposes: social.service.js never pairs two
// people when either one blocked the other.

import { prisma } from "../config/index.js";
import { AppError } from "../utils/errors.js";
import { BLOCK_MESSAGES } from "../locales/es.js";

/** Lower-case, no accents, single spaces: "  José  PÉREZ " -> "jose perez". */
export function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const tokensOf = (value) => normalizeName(value).split(" ").filter(Boolean).sort();

/** True when both names have the same words, in any order ("Pérez José" == "jose perez"). */
export function sameFullName(typed, firstName, lastName) {
  const a = tokensOf(typed);
  const b = tokensOf(`${firstName ?? ""} ${lastName ?? ""}`);
  return a.length > 0 && a.length === b.length && a.every((token, i) => token === b[i]);
}

const toBlockView = (block, user) => ({
  id: block.id,
  blockedId: block.blockedId,
  name: `${user.firstName} ${user.lastName}`.trim(),
  createdAt: block.createdAt,
});

export async function blockByName(blockerId, typedName) {
  const tokens = tokensOf(typedName);
  if (tokens.length === 0) throw new AppError(BLOCK_MESSAGES.NAME_REQUIRED, 422);

  // Narrow in SQL (every typed word must appear in first or last name), then
  // decide the exact match in JS where accents/word order are easy to ignore.
  // `contains` is accent-sensitive in Postgres, so also try the raw words.
  const rawWords = String(typedName).trim().split(/\s+/).filter(Boolean);
  const candidates = await prisma.user.findMany({
    where: {
      role: "USER",
      isActive: true,
      AND: rawWords.map((word) => ({
        OR: [
          { firstName: { contains: word, mode: "insensitive" } },
          { lastName: { contains: word, mode: "insensitive" } },
        ],
      })),
    },
    select: { id: true, firstName: true, lastName: true },
    take: 50,
  });

  const matches = candidates.filter((u) => sameFullName(typedName, u.firstName, u.lastName));

  if (matches.length === 0) {
    // Everybody typed their own name?
    throw new AppError(BLOCK_MESSAGES.NOT_FOUND, 404);
  }
  if (matches.length > 1) throw new AppError(BLOCK_MESSAGES.AMBIGUOUS, 409);

  const target = matches[0];
  if (target.id === blockerId) throw new AppError(BLOCK_MESSAGES.CANNOT_BLOCK_SELF, 400);

  const existing = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId: target.id } },
  });
  if (existing) return { ...toBlockView(existing, target), alreadyBlocked: true };

  const created = await prisma.userBlock.create({
    data: { blockerId, blockedId: target.id },
  });
  return { ...toBlockView(created, target), alreadyBlocked: false };
}

export async function listBlocks(blockerId) {
  const blocks = await prisma.userBlock.findMany({
    where: { blockerId },
    orderBy: { createdAt: "desc" },
    include: { blocked: { select: { firstName: true, lastName: true } } },
  });
  return blocks.map((b) => toBlockView(b, b.blocked));
}

export async function unblock(blockerId, blockedId) {
  const res = await prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
  return { removed: res?.count ?? 0 };
}
