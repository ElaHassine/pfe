# Lesio Backend

MongoDB + Express API for patient authentication, profile management, scans, community posts, comments, likes, and activity tracking.

## Requirements
- Node.js 18+
- MongoDB running locally or in the cloud

## Setup
1. Make sure MongoDB is running on your machine or use a MongoDB Atlas connection string.
2. Copy `.env.example` to `.env`
3. Set `MONGODB_URI` and `JWT_SECRET`
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start the server:
   ```bash
   npm run dev
   ```

## PyTorch Model Inference (Optional)
If you have a custom PyTorch model, the `/api/catalog/analysis/gradcam` endpoint can use it.

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Configure backend `.env`:
   ```bash
   PYTHON_EXECUTABLE=python
   PYTORCH_MODEL_PATH=C:\\path\\to\\your\\model.pt
   MODEL_CLASS_NAMES=low,medium,high
   ```

Notes:
- TorchScript `.pt/.pth` is preferred.
- If model inference fails, backend falls back to built-in heuristic scoring so API still responds.

## Main Collections
- `patients`
- `doctors`
- `scans`
- `communityposts`
- `comments`
- `postlikes`
- `activityevents`

## MongoDB Notes
- Store image files in a service like Cloudinary or S3, then save the URL in MongoDB.
- Keep passwords only as hashes in `passwordHash`.
- Use the `postlikes` collection for liked-post lookups and unique user-post pairs.
- If you use a local MongoDB install, `mongodb://127.0.0.1:27017/lesio` is a good default URI.

## API Summary
### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/me`

### Patients
- `GET /api/patients/me/summary`
- `GET /api/patients/me/activity`
- `GET /api/patients/:id`
- `GET /api/patients/:id/activity`
- `GET /api/patients/:id/liked-posts`

### Community
- `GET /api/community/posts`
- `POST /api/community/posts`
- `GET /api/community/posts/:postId`
- `GET /api/community/posts/:postId/comments`
- `POST /api/community/posts/:postId/comments`
- `POST /api/community/posts/:postId/like`
- `DELETE /api/community/posts/:postId/like`

### Doctor Portal
- `POST /api/doctor/auth/register`
- `POST /api/doctor/auth/login`
- `GET /api/doctor/auth/me`
- `PATCH /api/doctor/auth/me`
- `GET /api/doctor/dashboard`
- `GET /api/doctor/cases`
- `GET /api/doctor/cases/:id`
- `GET /api/doctor/patients`
- `GET /api/doctor/community/posts`
- `GET /api/doctor/community/summary`

### Scans
- `GET /api/scans`
- `POST /api/scans`
- `GET /api/scans/:scanId`

## Notes
- Passwords are stored as `passwordHash` only.
- Community image fields store URLs/keys, not raw image data.
- Activity events are written on login, scan creation, post creation, comment creation, like, and unlike.
