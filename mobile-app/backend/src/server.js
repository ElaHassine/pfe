require('dotenv').config();

const app = require('./app');
const { connectDatabase } = require('./config/db');
const Doctor = require('./models/Doctor');
const BookingRequest = require('./models/BookingRequest');
const BlogPost = require('./models/BlogPost');
const { RICH_BLOG_CONTENT } = require('./data/blogs');

const PORT = process.env.PORT || 4000;

const CATEGORY_COLORS = {
  Detection: '#00C2B2',
  Education: '#6366F1',
  Prevention: '#F59E0B',
  Reference: '#00C48C',
  Treatment: '#45B7D1',
  Dermatology: '#EC4899',
  Screening: '#8B5CF6',
  Skincare: '#06B6D4',
  Wellness: '#10B981',
  'Case Studies': '#F97316',
};

async function seedBlogs() {
  try {
    const defaultDoctorId = new (require('mongoose')).Types.ObjectId();

    const operations = RICH_BLOG_CONTENT.map((blog) => ({
      updateOne: {
        filter: { title: blog.title },
        update: {
          $set: {
            authorDoctorId: defaultDoctorId,
            authorSnapshot: {
              name: blog.authorName || 'Expert',
              avatarUrl: '',
              specialty: blog.specialty || 'Dermatology',
            },
            title: blog.title,
            summary: blog.summary,
            content: blog.content,
            coverImageUrl: '',
            tags: [],
            keyPoints: blog.keyPoints || [],
            category: blog.category,
            color: CATEGORY_COLORS[blog.category] || CATEGORY_COLORS.Detection,
            readTime: blog.readTime,
            status: 'published',
            publishedAt: blog.publishedAt || new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await BlogPost.bulkWrite(operations);
    console.log(`✓ Synced ${RICH_BLOG_CONTENT.length} blog articles into the database.`, {
      matched: result.matchedCount,
      modified: result.modifiedCount,
      upserted: result.upsertedCount,
    });
  } catch (error) {
    console.error('Error seeding blogs:', error.message);
  }
}

async function start() {
  await connectDatabase();
  await Promise.all([
    Doctor.createCollection(),
    BookingRequest.createCollection(),
  ]);

  // Seed blogs
  await seedBlogs();

  app.listen(PORT, () => {
    console.log(`Lesio backend running on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
