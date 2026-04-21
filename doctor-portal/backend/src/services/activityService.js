const ActivityEvent = require('../models/ActivityEvent');

async function recordActivity(actorId, actorType, type, entityType, entityId = null, metadata = {}) {
  if (!actorId) return null;

  const payload = {
    actorType,
    type,
    entityType,
    entityId,
    metadata,
  };

  if (actorType === 'doctor') {
    payload.doctorId = actorId;
  } else {
    payload.patientId = actorId;
  }

  return ActivityEvent.create(payload);
}

async function recordPatientActivity(patientId, type, entityType, entityId = null, metadata = {}) {
  return recordActivity(patientId, 'patient', type, entityType, entityId, metadata);
}

async function recordDoctorActivity(doctorId, type, entityType, entityId = null, metadata = {}) {
  return recordActivity(doctorId, 'doctor', type, entityType, entityId, metadata);
}

module.exports = { recordActivity, recordPatientActivity, recordDoctorActivity };
