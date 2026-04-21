export const riskCfg = (level) => {
  switch ((level || '').toLowerCase()) {
    case 'high':   return { color: '#FF4757', bg: 'rgba(255,71,87,0.1)',   border: 'rgba(255,71,87,0.3)',   label: 'High Risk',     tw: 'text-risk-high bg-risk-highbg' };
    case 'medium': return { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', label: 'Moderate Risk', tw: 'text-risk-med bg-risk-medbg'   };
    default:       return { color: '#00C48C', bg: 'rgba(0,196,140,0.1)',  border: 'rgba(0,196,140,0.3)',  label: 'Low Risk',      tw: 'text-risk-low bg-risk-lowbg'   };
  }
};
