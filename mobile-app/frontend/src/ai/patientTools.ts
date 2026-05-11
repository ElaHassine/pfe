/**
 * Patient AI Agent Tools
 * OpenAI-compatible tool/function format for OpenRouter
 */

export const patientTools = [
  {
    type: 'function',
    function: {
      name: 'get_recent_scans',
      description:
        'Fetch the patient\'s most recent scans from the app backend. Use this when the user asks about their last scans, recent scans, or scan history.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_patient_data',
      description:
        'Fetch the patient\'s own data from the app backend. Use this to retrieve scans, appointments, notifications, profile info, or activity.',
      parameters: {
        type: 'object',
        properties: {
          dataType: {
            type: 'string',
            enum: [
              'recent_scans',
              'appointments',
              'notifications',
              'profile',
              'activity',
            ],
            description:
              'The type of data to fetch. Options: recent_scans, appointments, notifications, profile, activity',
          },
          limit: {
            type: 'number',
            description: 'Optional: Maximum number of items to return. Default is 5.',
            default: 5,
          },
        },
        required: ['dataType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_scan_detail',
      description:
        'Get full analysis details for a specific scan, including risk assessment, classification, and recommendations.',
      parameters: {
        type: 'object',
        properties: {
          scanId: {
            type: 'string',
            description: 'The unique identifier of the scan to retrieve details for.',
          },
        },
        required: ['scanId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate_to_screen',
      description:
        'Navigate the patient to a relevant screen in the app, such as their scans, appointments, or dermatologist finder.',
      parameters: {
        type: 'object',
        properties: {
          screen: {
            type: 'string',
            enum: [
              'Scans',
              'ScanDetail',
              'ScanCapture',
              'LesionTracking',
              'Appointments',
              'DermatologistFinder',
              'Notifications',
              'Activity',
            ],
            description:
              'The screen to navigate to. Options: Scans, ScanDetail, ScanCapture, LesionTracking, Appointments, DermatologistFinder, Notifications, Activity',
          },
          params: {
            type: 'object',
            description:
              'Optional parameters to pass to the screen (e.g., { scanId: "123" } for ScanDetail)',
          },
        },
        required: ['screen'],
      },
    },
  },
];
