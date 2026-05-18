const mongoose = require('mongoose');
const http = require('http');
const https = require('https');
const asyncHandler = require('../middleware/asyncHandler');
const BlogPost = require('../models/BlogPost');

function buildAuthorSnapshot(doctor = {}) {
  return {
    name: doctor?.profile?.fullName || doctor?.email || 'Doctor',
    avatarUrl: doctor?.profile?.avatarUrl || '',
    specialty: doctor?.specialty || '',
  };
}

function estimateReadTime(content = '') {
  const words = String(content || '').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 220))} min read`;
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag || '').trim()).filter(Boolean);
  }

  return String(tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeList(values) {
  if (!Array.isArray(values)) return [];

  return values.map((value) => String(value || '').trim()).filter(Boolean);
}

function toBlogItem(blog) {
  return {
    id: String(blog._id),
    authorDoctorId: String(blog.authorDoctorId || ''),
    authorSnapshot: blog.authorSnapshot || { name: 'Doctor', avatarUrl: '', specialty: '' },
    title: blog.title || '',
    summary: blog.summary || '',
    content: blog.content || '',
    coverImageUrl: blog.coverImageUrl || '',
    tags: blog.tags || [],
    keyPoints: blog.keyPoints || [],
    category: blog.category || 'Doctor Blog',
    color: blog.color || '',
    readTime: blog.readTime || estimateReadTime(blog.content || blog.summary || ''),
    status: blog.status || 'draft',
    publishedAt: blog.publishedAt || null,
    createdAt: blog.createdAt,
    updatedAt: blog.updatedAt,
  };
}

function validatePublishedBlog(body = {}) {
  const errors = [];
  if (!String(body.title || '').trim()) errors.push('title');
  if (!String(body.summary || '').trim()) errors.push('summary');
  if (!String(body.content || '').trim()) errors.push('content');
  return errors;
}

async function getBlogOr404(blogId) {
  if (!mongoose.Types.ObjectId.isValid(blogId)) {
    return null;
  }

  return BlogPost.findById(blogId);
}

exports.listPublishedBlogs = asyncHandler(async (_req, res) => {
  const localBlogs = await BlogPost.find({ status: 'published' })
    .sort({ publishedAt: -1, createdAt: -1 })
    .lean();

  // Try to fetch published blogs from a doctor-portal API and merge results.
  const doctorPortalBase = process.env.DOCTOR_PORTAL_API_URL || 'http://localhost:4001';

  function fetchJson(url) {
    return new Promise((resolve, reject) => {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(url, (resp) => {
        let data = '';
        resp.on('data', (chunk) => { data += chunk; });
        resp.on('end', () => {
          try {
            const parsed = JSON.parse(data || '{}');
            resolve(parsed);
          } catch (err) {
            reject(err);
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  let remoteBlogs = [];
  try {
    const payload = await fetchJson(`${doctorPortalBase}/api/doctor/blogs`);
    if (payload && Array.isArray(payload.blogs)) {
      remoteBlogs = payload.blogs
        .filter((b) => (b.status || 'published') === 'published')
        .map((b) => ({
          id: b.id || String(b._id || ''),
          authorDoctorId: b.authorDoctorId || b.authorId || '',
          authorSnapshot: b.authorSnapshot || { name: 'Doctor', avatarUrl: '', specialty: '' },
          title: b.title || '',
          summary: b.summary || '',
          content: b.content || '',
          coverImageUrl: b.coverImageUrl || '',
          tags: b.tags || [],
          keyPoints: b.keyPoints || [],
          category: b.category || 'Doctor Blog',
          color: b.color || '',
          readTime: b.readTime || estimateReadTime(b.content || b.summary || ''),
          status: b.status || 'published',
          publishedAt: b.publishedAt || null,
          createdAt: b.createdAt || null,
          updatedAt: b.updatedAt || null,
        }));
    }
  } catch (err) {
    // If remote fetch fails, continue with local blogs only.
    console.warn('Failed to fetch remote doctor blogs:', err && err.message);
  }

  // Merge local and remote (avoid duplicates by id)
  const byId = new Map();
  (localBlogs.map(toBlogItem)).forEach((b) => byId.set(String(b.id), b));
  (remoteBlogs || []).forEach((b) => {
    const key = String(b.id || '');
    if (!key) return;
    if (!byId.has(key)) {
      // remote already has normalized shape, but ensure consistent keys
      byId.set(key, {
        id: String(b.id),
        authorDoctorId: String(b.authorDoctorId || ''),
        authorSnapshot: b.authorSnapshot || { name: 'Doctor', avatarUrl: '', specialty: '' },
        title: b.title || '',
        summary: b.summary || '',
        content: b.content || '',
        coverImageUrl: b.coverImageUrl || '',
        tags: b.tags || [],
        keyPoints: b.keyPoints || [],
        category: b.category || 'Doctor Blog',
        color: b.color || '',
        readTime: b.readTime || estimateReadTime(b.content || b.summary || ''),
        status: b.status || 'published',
        publishedAt: b.publishedAt || null,
        createdAt: b.createdAt || null,
        updatedAt: b.updatedAt || null,
      });
    }
  });

  res.json({ blogs: Array.from(byId.values()).sort((a, b) => {
    const ta = new Date(a.publishedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.publishedAt || b.createdAt || 0).getTime();
    return tb - ta;
  }) });
});

exports.listDoctorBlogs = asyncHandler(async (req, res) => {
  const blogs = await BlogPost.find({
    $or: [
      { status: 'published' },
      { authorDoctorId: req.user._id },
    ],
  })
    .sort({ status: 1, updatedAt: -1, createdAt: -1 })
    .lean();

  res.json({ blogs: blogs.map(toBlogItem) });
});

exports.getBlogById = asyncHandler(async (req, res) => {
  const blog = await getBlogOr404(req.params.blogId);
  if (!blog) {
    return res.status(404).json({ message: 'Blog not found' });
  }

  // Published blogs are public; drafts require author auth
  if (blog.status === 'draft') {
    if (!req.user || String(blog.authorDoctorId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }

  res.json({ blog: toBlogItem(blog) });
});

exports.createBlog = asyncHandler(async (req, res) => {
  const status = req.body.status === 'published' ? 'published' : 'draft';
  const validationErrors = status === 'published' ? validatePublishedBlog(req.body) : [];

  if (validationErrors.length) {
    return res.status(400).json({ message: 'Title, summary, and content are required to publish a blog' });
  }

  const blog = await BlogPost.create({
    authorDoctorId: req.user._id,
    authorSnapshot: buildAuthorSnapshot(req.user),
    title: String(req.body.title || '').trim(),
    summary: String(req.body.summary || '').trim(),
    content: String(req.body.content || '').trim(),
    coverImageUrl: String(req.body.coverImageUrl || '').trim(),
    tags: normalizeTags(req.body.tags),
    keyPoints: normalizeList(req.body.keyPoints),
    category: String(req.body.category || '').trim() || 'Doctor Blog',
    readTime: String(req.body.readTime || '').trim() || estimateReadTime(req.body.content || req.body.summary || ''),
    status,
    publishedAt: status === 'published' ? new Date() : null,
  });

  res.status(201).json({ blog: toBlogItem(blog) });
});

exports.updateBlog = asyncHandler(async (req, res) => {
  const blog = await getBlogOr404(req.params.blogId);
  if (!blog) {
    return res.status(404).json({ message: 'Blog not found' });
  }

  if (String(blog.authorDoctorId) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const nextStatus = req.body.status === 'published' ? 'published' : 'draft';
  if (nextStatus === 'published') {
    const validationErrors = validatePublishedBlog(req.body);
    if (validationErrors.length) {
      return res.status(400).json({ message: 'Title, summary, and content are required to publish a blog' });
    }
  }

  blog.title = String(req.body.title ?? blog.title ?? '').trim();
  blog.summary = String(req.body.summary ?? blog.summary ?? '').trim();
  blog.content = String(req.body.content ?? blog.content ?? '').trim();
  blog.coverImageUrl = String(req.body.coverImageUrl ?? blog.coverImageUrl ?? '').trim();
  blog.tags = normalizeTags(req.body.tags ?? blog.tags);
  blog.keyPoints = normalizeList(req.body.keyPoints ?? blog.keyPoints);
  blog.category = String(req.body.category ?? blog.category ?? '').trim() || 'Doctor Blog';
  blog.readTime = String(req.body.readTime || '').trim() || estimateReadTime(blog.content || blog.summary || '');
  blog.status = nextStatus;
  blog.publishedAt = nextStatus === 'published' ? (blog.publishedAt || new Date()) : null;

  await blog.save();

  res.json({ blog: toBlogItem(blog) });
});

exports.deleteBlog = asyncHandler(async (req, res) => {
  const blog = await getBlogOr404(req.params.blogId);
  if (!blog) {
    return res.status(404).json({ message: 'Blog not found' });
  }

  if (String(blog.authorDoctorId) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  await BlogPost.deleteOne({ _id: blog._id });
  res.json({ success: true });
});