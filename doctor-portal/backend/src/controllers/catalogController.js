const asyncHandler = require('../middleware/asyncHandler');
const Scan = require('../models/Scan');
const Doctor = require('../models/Doctor');
const { articles } = require('../data/catalog');
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

exports.listDoctors = asyncHandler(async (_req, res) => {
  const doctors = await Doctor.find({
    $and: [
      { $or: [{ active: true }, { active: { $exists: false } }] },
      { $or: [{ role: 'doctor' }, { role: { $exists: false } }] },
    ],
  })
    .select('email profile specialty availability')
    .sort({ createdAt: -1 })
    .lean();

  const doctorList = doctors.map((doctor) => {
    const firstName = doctor.profile?.firstName || '';
    const lastName = doctor.profile?.lastName || '';
    const computedName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const displayName = doctor.profile?.fullName || (computedName ? `Dr. ${computedName}` : 'Dr. Dermatology Specialist');

    return {
      id: String(doctor._id),
      name: displayName,
      email: doctor.email || 'Unavailable',
      phone: doctor.profile?.phone || 'Unavailable',
      location: doctor.profile?.location || 'Unavailable',
      specialty: doctor.specialty || 'Dermatology',
      rating: 4.8,
      reviews: 0,
      distance: doctor.profile?.location || 'Nearby',
      available: doctor.availability?.status === 'available',
      nextSlot: doctor.availability?.nextSlot || 'Next available slot',
      consultFee: '$--',
    };
  });

  res.json({ doctors: doctorList });
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

  res.json({ history: history.length ? history : [
    { month: 'Jan', score: 22 },
    { month: 'Feb', score: 18 },
    { month: 'Mar', score: 45 },
    { month: 'Apr', score: 38 },
    { month: 'May', score: 72 },
  ] });
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
    : result.confidence;
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

  res.json({
    riskLevel: resolvedRiskLevel,
    confidence: resolvedConfidence,
    lesionType: resolvedLesionType,
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
