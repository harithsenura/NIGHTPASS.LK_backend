const { z } = require('zod');

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signinSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const eventSchema = z.object({
  title: z.string().min(3, 'Title is too short'),
  date: z.string(),
  venue: z.string(),
  price: z.number().nonnegative(),
  image: z.string().optional(),
  coverPhoto: z.string().optional(),
  status: z.string().optional(),
  artist: z.string().optional(),
  location: z.string().optional(),
});

const commentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  comment: z.string().min(5, 'Comment must be at least 5 characters'),
  email: z.string().email().optional().or(z.literal('')),
});

module.exports = {
  signupSchema,
  signinSchema,
  eventSchema,
  commentSchema,
};
