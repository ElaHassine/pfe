const asyncHandler = require('../middleware/asyncHandler');
const mongoose = require('mongoose');
const Scan = require('../models/Scan');
const Doctor = require('../models/Doctor');
const DoctorReview = require('../models/DoctorReview');
const { articles } = require('../data/catalog');
const staticDoctors = require('../data/staticDoctors');
const { computeGradCAM } = require('../services/gradcamService');
const { inferLesionFromPyTorch } = require('../services/pytorchInferenceService');

function buildEstimatedCharacteristics(metrics, quality, riskLevel) {
  const characteristics = [];

  if ((metrics?.asymmetry || 0) > 0.12) characteristics.push('Estimated asymmetric pattern');
  if ((metrics?.borderIrregularity || 0) > 0.055) characteristics.push('Estimated irregular border texture');
  if ((metrics?.colorVariance || 0) > 0.06) characteristics.push('Estimated color variation');
  if ((quality?.contrast || 0) < 0.03) characteristics.push('Low contrast capture');
  if ((quality?.detail || 0) < 0.015) characteristics.push('Low fine-detail signal');

  if (!characteristics.length) {
    characteristics.push(riskLevel === 'low' ? 'Estimated uniform lesion appearance' : 'Estimated mild variation pattern');
  }

  return characteristics.slice(0, 5);
}

function buildEstimatedAbcde(metrics, quality) {
  const asym = metrics?.asymmetry || 0;
  const border = metrics?.borderIrregularity || 0;
  const colorVar = metrics?.colorVariance || 0;
  const detail = quality?.detail || 0;

  return {
    A: {
      label: 'Asymmetry (estimated)',
      value: asym > 0.16 ? 'Elevated asymmetry' : asym > 0.1 ? 'Mild asymmetry' : 'Mostly symmetric',
      flag: asym > 0.1,
    },
    B: {
      label: 'Border (estimated)',
      value: border > 0.07 ? 'Irregular edge pattern' : border > 0.045 ? 'Slight irregularity' : 'Relatively smooth border',
      flag: border > 0.045,
    },
    C: {
      label: 'Color (estimated)',
      value: colorVar > 0.075 ? 'Multiple color tones' : colorVar > 0.05 ? 'Some color variation' : 'Uniform tone',
      flag: colorVar > 0.05,
    },
    D: {
      label: 'Diameter (estimated)',
      value: detail > 0.06 ? 'Possible larger lesion footprint' : 'No clear large-footprint signal',
      flag: detail > 0.06,
    },
    E: {
      label: 'Evolution',
      value: 'Needs time-series scans to assess change',
      flag: false,
    },
  };
}

function riskScore(level) {
  switch (String(level || '').toLowerCase()) {
    case 'high': return 3;
    case 'medium': return 2;
    default: return 1;
  }
}

function toReviewerName(patient) {
  const profile = patient?.profile || {};
  const fullName = (profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(' ')).trim();

  if (fullName) {
    const parts = fullName.split(' ').filter(Boolean);
    if (parts.length === 1) {
      return `${parts[0].slice(0, 1).toUpperCase()}***`;
    }
    const first = parts[0];
    const lastInitial = parts[parts.length - 1].slice(0, 1).toUpperCase();
    return `${first} ${lastInitial}.`;
  }

  const emailPrefix = String(patient?.email || '').split('@')[0] || 'Patient';
  return `${emailPrefix.slice(0, 1).toUpperCase()}***`;
}

function isDoctorOnline(doctor) {
  const lastSeenAt = doctor?.presence?.lastSeenAt ? new Date(doctor.presence.lastSeenAt).getTime() : 0;
  const isFresh = Number.isFinite(lastSeenAt) && (Date.now() - lastSeenAt) <= 90000;
  return Boolean(doctor?.presence?.isOnline && isFresh);
}

function normalizeStaticDoctor(doctor) {
  return {
    id: doctor.id,
    name: doctor.name,
    avatarUrl: doctor.avatarUrl || '',
    email: doctor.email || 'Unavailable',
    phone: doctor.phone || 'Unavailable',
    location: doctor.location || 'Unavailable',
    specialty: doctor.specialty || 'Dermatology',
    rating: Number(doctor.rating || 0),
    reviews: Number(doctor.reviews || 0),
    distance: doctor.location || doctor.city || 'Tunisia',
    available: Boolean(doctor.available),
    online: Boolean(doctor.online),
    nextSlot: doctor.nextSlot || 'Next available slot',
    consultFee: doctor.consultFee || '80 DT',
    city: doctor.city || '',
    static: true,
  };
}

function findStaticDoctor(doctorId) {
  return staticDoctors.find((doctor) => String(doctor.id) === String(doctorId)) || null;
}

exports.listDoctors = asyncHandler(async (_req, res) => {
  const doctors = await Doctor.find({
    $and: [
      { $or: [{ active: true }, { active: { $exists: false } }] },
      { $or: [{ role: 'doctor' }, { role: { $exists: false } }] },
    ],
  })
    .select('email profile specialty availability presence')
    .sort({ createdAt: -1 })
    .lean();

  const stats = await DoctorReview.aggregate([
    {
      $group: {
        _id: '$doctorId',
        avgRating: { $avg: '$rating' },
        reviews: { $sum: 1 },
      },
    },
  ]);

  const statsByDoctorId = new Map(
    stats.map((entry) => [
      String(entry._id),
      {
        avgRating: Number(entry.avgRating || 0),
        reviews: Number(entry.reviews || 0),
      },
    ])
  );

  const doctorList = doctors.map((doctor) => {
    const firstName = doctor.profile?.firstName || '';
    const lastName = doctor.profile?.lastName || '';
    const computedName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const displayName = doctor.profile?.fullName || (computedName ? `Dr. ${computedName}` : 'Dr. Dermatology Specialist');

    const reviewStats = statsByDoctorId.get(String(doctor._id));
    const avgRating = reviewStats?.avgRating || 0;
    const online = isDoctorOnline(doctor);

    return {
      id: String(doctor._id),
      name: displayName,
      avatarUrl: doctor.profile?.avatarUrl || '',
      email: doctor.email || 'Unavailable',
      phone: doctor.profile?.phone || 'Unavailable',
      location: doctor.profile?.location || 'Unavailable',
      specialty: doctor.specialty || 'Dermatology',
      rating: Number(avgRating.toFixed(1)) || 0,
      reviews: reviewStats?.reviews || 0,
      distance: doctor.profile?.location || 'Nearby',
      available: online,
      online,
      nextSlot: doctor.availability?.nextSlot || 'Next available slot',
      consultFee: '$--',
    };
  });

  const seededDoctors = staticDoctors.map(normalizeStaticDoctor);
  const mergedDoctors = [...seededDoctors, ...doctorList].reduce((accumulator, doctor) => {
    if (accumulator.some((existing) => String(existing.id).toLowerCase() === String(doctor.id).toLowerCase())) {
      return accumulator;
    }
    return [...accumulator, doctor];
  }, []);

  mergedDoctors.sort((left, right) => {
    const leftStatic = left.static ? 0 : 1;
    const rightStatic = right.static ? 0 : 1;
    if (leftStatic !== rightStatic) return leftStatic - rightStatic;
    const ratingDiff = Number(right.rating || 0) - Number(left.rating || 0);
    if (ratingDiff !== 0) return ratingDiff;
    return String(left.name || '').localeCompare(String(right.name || ''));
  });

  res.json({ doctors: mergedDoctors });
});

exports.getDoctorDetails = asyncHandler(async (req, res) => {
  const { doctorId } = req.params;

  const staticDoctor = findStaticDoctor(doctorId);
  if (staticDoctor) {
    return res.json({
      doctor: {
        id: staticDoctor.id,
        name: staticDoctor.name,
        avatarUrl: staticDoctor.avatarUrl || '',
        email: staticDoctor.email || 'Unavailable',
        phone: staticDoctor.phone || 'Unavailable',
        location: staticDoctor.location || 'Unavailable',
        specialty: staticDoctor.specialty || 'Dermatology',
        rating: Number(staticDoctor.rating || 0),
        reviews: Number(staticDoctor.reviews || 0),
        available: Boolean(staticDoctor.available),
        online: Boolean(staticDoctor.online),
        profile: {
          firstName: staticDoctor.name.replace(/^Dr\.\s*/i, '').split(' ')[0] || '',
          lastName: staticDoctor.name.replace(/^Dr\.\s*/i, '').split(' ').slice(1).join(' ') || '',
          fullName: staticDoctor.name,
          avatarUrl: staticDoctor.avatarUrl || '',
          phone: staticDoctor.phone || '',
          location: staticDoctor.location || '',
          bio: `${staticDoctor.specialty} based in ${staticDoctor.city}, Tunisia.`,
        },
        credentials: {
          licenseNumber: '',
          hospital: staticDoctor.city ? `${staticDoctor.city} Medical Center` : '',
          yearsExperience: 0,
        },
        availability: {
          status: staticDoctor.available ? 'available' : 'offline',
          nextSlot: staticDoctor.nextSlot || '',
        },
        presence: {
          isOnline: Boolean(staticDoctor.online),
          lastSeenAt: null,
        },
        active: true,
        static: true,
      },
    });
  }

  if (!mongoose.Types.ObjectId.isValid(doctorId)) {
    return res.status(400).json({ message: 'Invalid doctor id' });
  }

  const doctor = await Doctor.findOne({
    _id: doctorId,
    $and: [
      { $or: [{ active: true }, { active: { $exists: false } }] },
      { $or: [{ role: 'doctor' }, { role: { $exists: false } }] },
    ],
  })
    .select('email profile specialty credentials availability active presence')
    .lean();

  if (!doctor) {
    return res.status(404).json({ message: 'Doctor not found' });
  }

  const firstName = doctor.profile?.firstName || '';
  const lastName = doctor.profile?.lastName || '';
  const computedName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const displayName = doctor.profile?.fullName || (computedName ? `Dr. ${computedName}` : 'Dr. Dermatology Specialist');

  const stat = await DoctorReview.aggregate([
    { $match: { doctorId: new mongoose.Types.ObjectId(doctorId) } },
    {
      $group: {
        _id: '$doctorId',
        avgRating: { $avg: '$rating' },
        reviews: { $sum: 1 },
      },
    },
  ]);

  const avgRating = Number(stat?.[0]?.avgRating || 0);
  const reviews = Number(stat?.[0]?.reviews || 0);
  const online = isDoctorOnline(doctor);

  res.json({
    doctor: {
      id: String(doctor._id),
      name: displayName,
      avatarUrl: doctor.profile?.avatarUrl || '',
      email: doctor.email || 'Unavailable',
      phone: doctor.profile?.phone || 'Unavailable',
      location: doctor.profile?.location || 'Unavailable',
      specialty: doctor.specialty || 'Dermatology',
      rating: Number(avgRating.toFixed(1)) || 0,
      reviews,
      available: online,
      online,
      profile: {
        firstName: doctor.profile?.firstName || '',
        lastName: doctor.profile?.lastName || '',
        fullName: doctor.profile?.fullName || '',
        avatarUrl: doctor.profile?.avatarUrl || '',
        phone: doctor.profile?.phone || '',
        location: doctor.profile?.location || '',
        bio: doctor.profile?.bio || '',
      },
      credentials: {
        licenseNumber: doctor.credentials?.licenseNumber || '',
        hospital: doctor.credentials?.hospital || '',
        yearsExperience: Number(doctor.credentials?.yearsExperience || 0),
      },
      availability: {
        status: doctor.availability?.status || 'offline',
        nextSlot: doctor.availability?.nextSlot || '',
      },
      presence: {
        isOnline: online,
        lastSeenAt: doctor?.presence?.lastSeenAt || null,
      },
      active: Boolean(doctor.active),
    },
  });
});

exports.listDoctorReviews = asyncHandler(async (req, res) => {
  const { doctorId } = req.params;

  if (findStaticDoctor(doctorId)) {
    return res.json({
      reviews: [],
      stats: { rating: 0, reviews: 0 },
    });
  }

  if (!mongoose.Types.ObjectId.isValid(doctorId)) {
    return res.status(400).json({ message: 'Invalid doctor id' });
  }

  const reviews = await DoctorReview.find({ doctorId })
    .populate({ path: 'patientId', select: 'email profile' })
    .sort({ updatedAt: -1 })
    .lean();

  const reviewsList = reviews.map((item) => ({
    id: String(item._id),
    doctorId: String(item.doctorId),
    patientId: String(item.patientId?._id || item.patientId),
    patientName: toReviewerName(item.patientId),
    rating: Number(item.rating || 0),
    review: item.review || '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));

  const total = reviewsList.length;
  const avg = total
    ? reviewsList.reduce((sum, item) => sum + (item.rating || 0), 0) / total
    : 0;

  res.json({
    reviews: reviewsList,
    stats: {
      rating: Number(avg.toFixed(1)) || 0,
      reviews: total,
    },
  });
});

exports.upsertDoctorReview = asyncHandler(async (req, res) => {
  const { doctorId } = req.params;
  const rating = Number(req.body?.rating);
  const review = String(req.body?.review || '').trim();

  if (findStaticDoctor(doctorId)) {
    return res.status(404).json({ message: 'Doctor not found' });
  }

  if (!mongoose.Types.ObjectId.isValid(doctorId)) {
    return res.status(400).json({ message: 'Invalid doctor id' });
  }

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' });
  }

  if (review.length > 500) {
    return res.status(400).json({ message: 'Review must be 500 characters or fewer' });
  }

  const doctorExists = await Doctor.exists({ _id: doctorId });
  if (!doctorExists) {
    return res.status(404).json({ message: 'Doctor not found' });
  }

  const saved = await DoctorReview.findOneAndUpdate(
    { doctorId, patientId: req.user._id },
    { $set: { rating, review } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
    .populate({ path: 'patientId', select: 'email profile' })
    .lean();

  res.status(201).json({
    review: {
      id: String(saved._id),
      doctorId: String(saved.doctorId),
      patientId: String(saved.patientId?._id || saved.patientId),
      patientName: toReviewerName(saved.patientId),
      rating: Number(saved.rating || 0),
      review: saved.review || '',
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    },
  });
});

exports.deleteDoctorReview = asyncHandler(async (req, res) => {
  const { doctorId } = req.params;

  if (findStaticDoctor(doctorId)) {
    return res.status(404).json({ message: 'Review not found' });
  }

  if (!mongoose.Types.ObjectId.isValid(doctorId)) {
    return res.status(400).json({ message: 'Invalid doctor id' });
  }

  const deleted = await DoctorReview.findOneAndDelete({
    doctorId,
    patientId: req.user._id,
  });

  if (!deleted) {
    return res.status(404).json({ message: 'Review not found' });
  }

  res.json({ message: 'Review deleted successfully' });
});

exports.listArticles = asyncHandler(async (_req, res) => {
  res.json({ articles });
});

exports.getRiskHistory = asyncHandler(async (req, res) => {
  const scans = await Scan.find({ patientId: req.user._id }).sort({ createdAt: 1 }).lean();
  const months = new Map();

  scans.forEach((scan) => {
    const month = new Date(scan.createdAt).toLocaleDateString('en-US', { month: 'short' });
    const entry = months.get(month) || { month, values: [] };
    entry.values.push(riskScore(scan.riskLevel) * 25 + (scan.confidence || 0) / 4);
    months.set(month, entry);
  });

  const history = Array.from(months.values()).slice(-5).map((entry) => ({
    month: entry.month,
    score: Math.round(entry.values.reduce((sum, value) => sum + value, 0) / entry.values.length),
  }));

  res.json({ history });
});

exports.analyze = asyncHandler(async (_req, res) => {
  res.json({
    riskLevel: 'medium',
    confidence: 83,
    lesionType: 'Dysplastic Nevus',
    characteristics: ['Asymmetric border', 'Color variation', 'Diameter ~6mm', 'Flat surface'],
    recommendation: 'consult',
    abcde: {
      A: { label: 'Asymmetry', value: 'Moderate asymmetry', flag: true },
      B: { label: 'Border', value: 'Irregular edges', flag: true },
      C: { label: 'Color', value: '2-3 shades', flag: true },
      D: { label: 'Diameter', value: '~6mm', flag: false },
      E: { label: 'Evolution', value: 'Track needed', flag: false },
    },
  });
});

exports.analyzeWithGradCAM = asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ message: 'Image file is required' });
  }

  const result = await computeGradCAM(req.file.buffer);
  let modelPrediction = null;

  try {
    modelPrediction = await inferLesionFromPyTorch(req.file.buffer);
  } catch (error) {
    console.warn('PyTorch model inference failed:', error.message);
  }

  if (!result?.quality?.valid) {
    return res.json({
      noLesionDetected: true,
      code: 'NO_LESION_DETECTED',
      message: 'No lesion detected, try again.',
      quality: result?.quality || null,
    });
  }

  const resolvedRiskLevel = modelPrediction?.riskLevel || result.riskLevel;
  const resolvedConfidence = modelPrediction?.confidence
    ? Math.round(Number(modelPrediction.confidence) * 100)
    : Math.round(Number(result.confidence || 0) <= 1
      ? Number(result.confidence || 0) * 100
      : Number(result.confidence || 0));
  const secondClass = modelPrediction?.secondClass || null;
  const margin = Number(modelPrediction?.margin || 0);
  const isUncertain = !!modelPrediction && (resolvedConfidence < 60 || margin < 0.12);

  const resolvedLesionType = isUncertain && secondClass
    ? `Uncertain (${modelPrediction.predictedClass} vs ${secondClass})`
    : (modelPrediction?.predictedClass || result.lesionType);

  const resolvedRecommendation = isUncertain
    ? 'consult'
    : (modelPrediction?.recommendation
      || (resolvedRiskLevel === 'high' ? 'urgent' : resolvedRiskLevel === 'medium' ? 'consult' : 'monitor'));
  const estimatedAbcde = buildEstimatedAbcde(result.metrics, result.quality);
  const estimatedCharacteristics = buildEstimatedCharacteristics(result.metrics, result.quality, resolvedRiskLevel);

  // Debug logging: record modelPrediction and resolved values for troubleshooting
  try {
    console.info('GradCAM analysis - modelPrediction:', JSON.stringify(modelPrediction || null));
    console.info('GradCAM analysis - result.metrics:', JSON.stringify(result.metrics || null));
    console.info('GradCAM analysis - resolvedLesionType:', resolvedLesionType, 'resolvedConfidence:', resolvedConfidence, 'isUncertain:', isUncertain);
  } catch (e) {
    console.info('GradCAM logging failed:', e && e.message);
  }

  res.json({
    riskLevel: resolvedRiskLevel,
    confidence: resolvedConfidence,
    lesionType: resolvedLesionType,
    predictedClass: modelPrediction?.predictedClass || null,
    predictedIndex: modelPrediction?.predictedIndex ?? null,
    predictedConfidence: modelPrediction?.confidence ? Math.round(Number(modelPrediction.confidence) * 100) : null,
    characteristics: estimatedCharacteristics,
    recommendation: resolvedRecommendation,
    abcde: estimatedAbcde,
    abcdeEstimated: true,
    heatmap: result.heatmap.toString('base64'),
    heatmapShape: result.heatmapShape,
    quality: result.quality,
    metrics: result.metrics,
    bbox: result.bbox || null,
    modelUsed: !!modelPrediction,
    modelType: modelPrediction?.modelType || null,
    modelMargin: modelPrediction?.margin || null,
    modelSecondClass: secondClass,
    uncertaintyFlag: isUncertain,
  });
});
