// Validation error class
class ValidationError extends Error {
  constructor(errors) {
    super('Validation failed');
    this.errors = errors;
    this.name = 'ValidationError';
  }
}

// Utility functions for validation
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPassword = (password) => password && password.length >= 8;
const hasUpperLower = (password) => /^(?=.*[a-z])(?=.*[A-Z])/.test(password);
const hasNumber = (password) => /\d/.test(password);
const isValidUsername = (username) => /^[a-zA-Z0-9_]+$/.test(username);

// Login Schema
export const loginSchema = {
  parse(data) {
    const errors = [];
    if (!data.email) errors.push({ path: 'email', message: 'Email is required' });
    else if (!isValidEmail(data.email)) errors.push({ path: 'email', message: 'Invalid email format' });
    if (!data.password) errors.push({ path: 'password', message: 'Password is required' });
    else if (!isValidPassword(data.password)) errors.push({ path: 'password', message: 'Password must be at least 8 characters' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Register Schema
export const registerSchema = {
  parse(data) {
    const errors = [];
    if (!data.email) errors.push({ path: 'email', message: 'Email is required' });
    else if (!isValidEmail(data.email)) errors.push({ path: 'email', message: 'Invalid email format' });
    if (!data.password) errors.push({ path: 'password', message: 'Password is required' });
    else if (!isValidPassword(data.password)) errors.push({ path: 'password', message: 'Password must be at least 8 characters' });
    else if (!hasUpperLower(data.password) || !hasNumber(data.password)) errors.push({ path: 'password', message: 'Password must contain uppercase, lowercase and number' });
    if (!data.fullName) errors.push({ path: 'fullName', message: 'Full name is required' });
    else if (data.fullName.length < 2) errors.push({ path: 'fullName', message: 'Full name must be at least 2 characters' });
    if (!data.username) errors.push({ path: 'username', message: 'Username is required' });
    else if (data.username.length < 3 || data.username.length > 20) errors.push({ path: 'username', message: 'Username must be between 3 and 20 characters' });
    else if (!isValidUsername(data.username)) errors.push({ path: 'username', message: 'Username can only contain letters, numbers and underscores' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Update User Schema
export const updateUserSchema = {
  parse(data) {
    const errors = [];
    if (data.email && !isValidEmail(data.email)) errors.push({ path: 'email', message: 'Invalid email format' });
    if (data.username && (data.username.length < 3 || data.username.length > 20)) errors.push({ path: 'username', message: 'Username must be between 3 and 20 characters' });
    if (data.username && !isValidUsername(data.username)) errors.push({ path: 'username', message: 'Username can only contain letters, numbers and underscores' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Complete Profile Schema
export const completeProfileSchema = {
  parse(data) {
    const errors = [];
    if (!data.age) errors.push({ path: 'age', message: 'Age is required' });
    else if (data.age < 16 || data.age > 120) errors.push({ path: 'age', message: 'Age must be between 16 and 120' });
    if (!['beginner', 'intermediate', 'advanced'].includes(data.experienceLevel)) errors.push({ path: 'experienceLevel', message: 'Invalid experience level' });
    if (data.goals && !Array.isArray(data.goals)) errors.push({ path: 'goals', message: 'Goals must be an array' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Update Profile Schema
export const updateProfileSchema = {
  parse(data) {
    const errors = [];
    if (data.age && (data.age < 16 || data.age > 120)) errors.push({ path: 'age', message: 'Age must be between 16 and 120' });
    if (data.experienceLevel && !['beginner', 'intermediate', 'advanced'].includes(data.experienceLevel)) errors.push({ path: 'experienceLevel', message: 'Invalid experience level' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Points Manual Schema
export const pointsManualSchema = {
  parse(data) {
    const errors = [];
    if (!data.userId) errors.push({ path: 'userId', message: 'User ID is required' });
    if (typeof data.points !== 'number' || data.points === 0) errors.push({ path: 'points', message: 'Points must be a non-zero number' });
    if (!data.reason) errors.push({ path: 'reason', message: 'Reason is required' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Reward Schema
export const rewardSchema = {
  parse(data) {
    const errors = [];
    if (!data.name) errors.push({ path: 'name', message: 'Reward name is required' });
    if (typeof data.pointsCost !== 'number' || data.pointsCost < 0) errors.push({ path: 'pointsCost', message: 'Points cost must be a non-negative number' });
    if (typeof data.quantity !== 'number' || data.quantity < 0) errors.push({ path: 'quantity', message: 'Quantity must be a non-negative number' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Update Reward Schema
export const updateRewardSchema = {
  parse(data) {
    const errors = [];
    if (data.pointsCost !== undefined && (typeof data.pointsCost !== 'number' || data.pointsCost < 0)) errors.push({ path: 'pointsCost', message: 'Points cost must be a non-negative number' });
    if (data.quantity !== undefined && (typeof data.quantity !== 'number' || data.quantity < 0)) errors.push({ path: 'quantity', message: 'Quantity must be a non-negative number' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Rate Help Schema
export const rateHelpSchema = {
  parse(data) {
    const errors = [];
    if (typeof data.rating !== 'number' || data.rating < 1 || data.rating > 5) errors.push({ path: 'rating', message: 'Rating must be between 1 and 5' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Report Schema
export const reportSchema = {
  parse(data) {
    const errors = [];
    if (!data.reportedUserId) errors.push({ path: 'reportedUserId', message: 'Reported user ID is required' });
    if (!data.reason) errors.push({ path: 'reason', message: 'Reason is required' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Routine Schema
export const routineSchema = {
  parse(data) {
    const errors = [];
    if (!data.name) errors.push({ path: 'name', message: 'Routine name is required' });
    if (!Array.isArray(data.exercises)) errors.push({ path: 'exercises', message: 'Exercises must be an array' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Interaction Schema
export const interactionSchema = {
  parse(data) {
    const errors = [];
    if (!data.targetUserId) errors.push({ path: 'targetUserId', message: 'Target user ID is required' });
    if (!['like', 'dislike', 'comment'].includes(data.interactionType)) errors.push({ path: 'interactionType', message: 'Invalid interaction type' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Machine Schema
export const machineSchema = {
  parse(data) {
    const errors = [];
    if (!data.name) errors.push({ path: 'name', message: 'Machine name is required' });
    if (!data.category) errors.push({ path: 'category', message: 'Category is required' });
    if (typeof data.weight !== 'number' || data.weight < 0) errors.push({ path: 'weight', message: 'Weight must be a non-negative number' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Update Machine Schema
export const updateMachineSchema = {
  parse(data) {
    const errors = [];
    if (data.weight !== undefined && (typeof data.weight !== 'number' || data.weight < 0)) errors.push({ path: 'weight', message: 'Weight must be a non-negative number' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Review Schema
export const reviewSchema = {
  parse(data) {
    const errors = [];
    if (typeof data.rating !== 'number' || data.rating < 1 || data.rating > 5) errors.push({ path: 'rating', message: 'Rating must be between 1 and 5' });
    if (data.comment && typeof data.comment !== 'string') errors.push({ path: 'comment', message: 'Comment must be a string' });
    if (!data.machineId && !data.trainerId) errors.push({ path: 'targetId', message: 'Either machineId or trainerId is required' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Role Update Schema
export const roleUpdateSchema = {
  parse(data) {
    const errors = [];
    if (!['admin', 'trainer', 'user'].includes(data.role)) errors.push({ path: 'role', message: 'Invalid role. Must be admin, trainer, or user' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Gym Settings Schema
export const gymSettingsSchema = {
  parse(data) {
    const errors = [];
    if (data.gymName && typeof data.gymName !== 'string') errors.push({ path: 'gymName', message: 'Gym name must be a string' });
    if (data.openingHours && typeof data.openingHours !== 'string') errors.push({ path: 'openingHours', message: 'Opening hours must be a string' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Update Settings Schema
export const updateSettingsSchema = {
  parse(data) {
    const errors = [];
    if (data.theme && !['light', 'dark'].includes(data.theme)) errors.push({ path: 'theme', message: 'Invalid theme. Must be light or dark' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Progress Schema
export const progressSchema = {
  parse(data) {
    const errors = [];
    if (!data.exerciseName) errors.push({ path: 'exerciseName', message: 'Exercise name is required' });
    if (typeof data.weight !== 'number' || data.weight <= 0) errors.push({ path: 'weight', message: 'Weight must be positive' });
    if (!Number.isInteger(data.reps) || data.reps <= 0) errors.push({ path: 'reps', message: 'Reps must be a positive integer' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Help Request Schema
export const helpRequestSchema = {
  parse(data) {
    const errors = [];
    if (!data.description) errors.push({ path: 'description', message: 'Description is required' });
    else if (data.description.length > 500) errors.push({ path: 'description', message: 'Description cannot exceed 500 characters' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Personalization Schema
export const personalizationSchema = {
  parse(data) {
    const errors = [];
    if (!data.fieldName) errors.push({ path: 'fieldName', message: 'Field name is required' });
    if (errors.length > 0) throw new ValidationError(errors);
    return data;
  },
  safeParse(data) {
    try {
      const result = this.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }
};

// Middleware helper for validation
export const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: error.errors,
    });
  }
};

export class ValidationError extends Error {
  constructor(errors) {
    super('Validation failed');
    this.errors = errors;
    this.name = 'ValidationError';
  }
}

export const loginQRSchema = z.object({
  personalQRCode: z.string().min(3).describe("Personal QR code for member login"),
});

export const emailSchema = z.object({
  email: z.string().email().describe("User email for password reset"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10).describe("Reset token from email"),
  newPassword: z.string().min(8).describe("New password"),
  confirmPassword: z.string().min(8).describe("Confirm new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).describe("Current password"),
  newPassword: z.string().min(8).describe("New password"),
  confirmPassword: z.string().min(8).describe("Confirm new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});


export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
  bio: z.string().max(500).optional(),
  photoUrl: z.string().url().optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128)
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const createRoutineSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  exercises: z.array(z.string()).min(1),
  duration: z.number().int().positive()
});

export const updateRoutineSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  exercises: z.array(z.string()).optional(),
  duration: z.number().int().positive().optional()
});

export const createReviewSchema = z.object({
  targetId: z.string().uuid(),
  targetType: z.enum(['MACHINE', 'TRAINER']),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional()
});

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(500).optional()
});

export const createCheckInSchema = z.object({
  machineId: z.string().uuid().optional(),
  caloriesBurned: z.number().non_negative().optional(),
  duration: z.number().int().positive()
});

export const createRewardSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  pointsCost: z.number().int().positive(),
  category: z.enum(['BADGE', 'DISCOUNT', 'ITEM', 'CLASS']),
  rewardData: z.record(z.any()).optional()
});

export const claimRewardSchema = z.object({
  rewardId: z.string().uuid()
});

export const helpRequestSchema = z.object({
  category: z.enum(['TECHNICAL', 'BILLING', 'ACCOUNT', 'OTHER']),
  subject: z.string().min(5).max(100),
  description: z.string().min(10).max(2000),
  attachmentUrl: z.string().url().optional()
});

export const pauseAccountSchema = z.object({
  reason: z.string().max(500).optional(),
  duration: z.number().int().positive() // días
});

export const updateMachineSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['AVAILABLE', 'MAINTENANCE', 'BROKEN']).optional(),
  photoUrl: z.string().url().optional()
});

export const bulkUpdateUsersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
  updates: z.object({
    role: z.enum(['ADMIN', 'TRAINER', 'USER']).optional(),
    status: z.enum(['ACTIVE', 'PAUSED', 'BANNED']).optional(),
    tags: z.array(z.string()).optional()
  })
});

import { z } from 'zod';

// Email validation
const emailSchema = z.string().email('Invalid email format').max(100);

// Password validation
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[0-9]/, 'Password must contain number');

// Login Schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8),
});

// Register Schema
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().min(2).max(100),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
});

// Update User Schema
export const updateUserSchema = z.object({
  email: emailSchema.optional(),
  username: z.string().min(3).max(20).optional(),
  fullName: z.string().min(2).max(100).optional(),
}).strict(); // Prevent extra fields

// Complete Profile Schema
export const completeProfileSchema = z.object({
  age: z.number().int().min(16).max(120),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  goals: z.array(z.string()).optional(),
});

export const searchSchema = z.object({
  query: z.string().max(100).trim(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(50).default(20),
});

export const validateWithZod = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next();
    }
  };
};