import { prisma } from "../prisma/prisma.js";
import { ERROR_CODES, paginate } from "../shared/utils.js";

export const getMachines = async (req, res) => {
  const { category, status, page = 1, limit = 20 } = req.query;

  try {
    const pagination = paginate(parseInt(page), parseInt(limit));
    const where = {};
    if (category) where.category = category;
    if (status) where.status = status;

    const [machines, total] = await Promise.all([
      prisma.machine.findMany({
        where,
        orderBy: { name: "asc" },
        ...pagination
      }),
      prisma.machine.count({ where })
    ]);

    return res.status(200).json({
      machines,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("[MACHINES] Get machines error:", error);
    return res.status(500).json({
      error: "Failed to get machines",
      code: ERROR_CODES.INTERNAL_ERROR
    });
  }
};

export const getMachine = async (req, res) => {
  const { machineId } = req.params;

  try {
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                username: true,
                photoUrl: true
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 10
        }
      }
    });

    if (!machine) {
      return res.status(404).json({
        error: "Machine not found",
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return res.status(200).json({ machine });
  } catch (error) {
    console.error("[MACHINES] Get machine error:", error);
    return res.status(500).json({
      error: "Failed to get machine",
      code: ERROR_CODES.INTERNAL_ERROR
    });
  }
};