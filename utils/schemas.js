const { z } = require('zod');

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  isOrganizer: z.boolean().optional(),
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
  image: z.string().optional().nullable(),
  coverPhoto: z.string().optional().nullable(),
  status: z.string().optional(),
  artist: z.string().optional(),
  location: z.string().optional(),
  time: z.string().optional(),
  attendees: z.number().optional(),
  description: z.string().optional(),
  highlights: z.array(z.any()).optional(),
  guidelines: z.array(z.any()).optional(),
  setTimes: z.array(z.any()).optional(),
  capacity: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  venueAddress: z.string().optional(),
  venueMapLink: z.string().optional(),
  transportPublic: z.string().optional(),
  transportDriving: z.string().optional(),
  trailerUrl: z.string().optional(),
  artists: z.array(z.any()).optional(),
  tickets: z.array(z.any()).optional(),
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
