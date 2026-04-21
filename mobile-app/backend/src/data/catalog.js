const doctors = [
  { id: 'd1', name: 'Dr. Sarah Chen', specialty: 'Dermatology & Skin Oncology', rating: 4.9, reviews: 247, distance: '0.8 mi', available: true, nextSlot: 'Today, 3:00 PM', consultFee: '$120' },
  { id: 'd2', name: 'Dr. Marcus Webb', specialty: 'Clinical Dermatology', rating: 4.7, reviews: 189, distance: '1.2 mi', available: true, nextSlot: 'Tomorrow, 10:00 AM', consultFee: '$95' },
  { id: 'd3', name: 'Dr. Priya Nair', specialty: 'Dermatopathology', rating: 4.8, reviews: 312, distance: '2.1 mi', available: false, nextSlot: 'Thu, 2:30 PM', consultFee: '$140' },
];

const articles = [
  {
    id: 'a1',
    title: 'Understanding the ABCDE Rule',
    category: 'Detection',
    readTime: '4 min',
    color: '#00C2B2',
    summary: 'Spot early warning signs of melanoma using the ABCDE method.',
    keyTakeaways: [
      'A for Asymmetry: one half of the lesion does not match the other.',
      'B for Border: irregular, notched, or blurred edges may be concerning.',
      'C for Color: multiple shades in one lesion can indicate risk.',
      'D for Diameter: lesions larger than 6mm should be checked, but smaller ones can still be serious.',
      'E for Evolution: any recent change in size, shape, color, or symptoms matters most.',
    ],
    preventionPlan:
      'Take monthly skin photos under similar lighting, compare changes over time, and schedule a dermatologist visit when an ABCDE sign appears or progresses.',
  },
  {
    id: 'a2',
    title: 'Types of Skin Cancer',
    category: 'Education',
    readTime: '6 min',
    color: '#6366F1',
    summary: 'Guide to melanoma, basal cell, and squamous cell carcinoma.',
    keyTakeaways: [
      'Melanoma is less common but more aggressive and should be evaluated quickly.',
      'Basal cell carcinoma often grows slowly and may appear pearly or ulcerated.',
      'Squamous cell carcinoma can look scaly, crusted, or persistently inflamed.',
      'Early diagnosis significantly improves treatment outcomes across all types.',
      'Biopsy is the standard method to confirm diagnosis and guide treatment.',
    ],
    preventionPlan:
      'Protect high-exposure areas daily, avoid tanning beds, and arrange routine skin checks if you have fair skin, many moles, family history, or previous skin cancer.',
  },
  {
    id: 'a3',
    title: 'Sun Protection Guide',
    category: 'Prevention',
    readTime: '3 min',
    color: '#F59E0B',
    summary: 'Evidence-based strategies to protect your skin year-round.',
    keyTakeaways: [
      'Use broad-spectrum SPF 30+ every day, not only on sunny days.',
      'Reapply sunscreen every 2 hours and after sweating or swimming.',
      'Wear UV-protective clothing, hats, and sunglasses for added defense.',
      'Seek shade between 10 a.m. and 4 p.m. when UV radiation peaks.',
      'Children and sensitive skin types need stricter UV protection routines.',
    ],
    preventionPlan:
      'Build a daily routine: apply sunscreen in the morning, carry a travel-size reapplication option, and combine SPF with shade and protective clothing.',
  },
  {
    id: 'a4',
    title: 'Common Benign Lesions',
    category: 'Reference',
    readTime: '5 min',
    color: '#00C48C',
    summary: 'Identifying moles, keratosis, and non-cancerous growths.',
    keyTakeaways: [
      'Many lesions are benign, including seborrheic keratoses and skin tags.',
      'Benign moles are often symmetric, uniform in color, and stable over time.',
      'Inflamed benign lesions can temporarily mimic warning signs.',
      'Persistent change, bleeding, or itching should still be assessed clinically.',
      'When uncertain, dermoscopy and professional review provide safer clarification.',
    ],
    preventionPlan:
      'Track baseline lesions with photos and note any persistent changes over several weeks; seek medical review rather than self-diagnosing uncertain lesions.',
  },
];

module.exports = { doctors, articles };
