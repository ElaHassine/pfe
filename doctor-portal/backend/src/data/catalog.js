const doctors = [
  { id: 'd1', name: 'Dr. Sarah Chen', specialty: 'Dermatology & Skin Oncology', rating: 4.9, reviews: 247, distance: '0.8 mi', available: true, nextSlot: 'Today, 3:00 PM', consultFee: '$120' },
  { id: 'd2', name: 'Dr. Marcus Webb', specialty: 'Clinical Dermatology', rating: 4.7, reviews: 189, distance: '1.2 mi', available: true, nextSlot: 'Tomorrow, 10:00 AM', consultFee: '$95' },
  { id: 'd3', name: 'Dr. Priya Nair', specialty: 'Dermatopathology', rating: 4.8, reviews: 312, distance: '2.1 mi', available: false, nextSlot: 'Thu, 2:30 PM', consultFee: '$140' },
];

const articles = [
  { id: 'a1', title: 'Understanding the ABCDE Rule', category: 'Detection', readTime: '4 min', color: '#00C2B2', summary: 'Spot early warning signs of melanoma using the ABCDE method.' },
  { id: 'a2', title: 'Types of Skin Cancer', category: 'Education', readTime: '6 min', color: '#6366F1', summary: 'Guide to melanoma, basal cell, and squamous cell carcinoma.' },
  { id: 'a3', title: 'Sun Protection Guide', category: 'Prevention', readTime: '3 min', color: '#F59E0B', summary: 'Evidence-based strategies to protect your skin year-round.' },
  { id: 'a4', title: 'Common Benign Lesions', category: 'Reference', readTime: '5 min', color: '#00C48C', summary: 'Identifying moles, keratosis, and non-cancerous growths.' },
];

module.exports = { doctors, articles };
