export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export const getTimeAgo = (dateString, t) => {
  if (!dateString) return '';
  const start = new Date(dateString).getTime();
  const now = new Date().getTime();
  const diff = Math.floor((now - start) / 1000);
  if (diff < 60) return t ? t('time.seconds_ago', '{{count}} giây trước', { count: diff }) : `${diff} giây trước`;
  const m = Math.floor(diff / 60);
  if (m < 60) return t ? t('time.minutes_ago', '{{count}} phút trước', { count: m }) : `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return t ? t('time.hours_ago', '{{count}} giờ trước', { count: h }) : `${h} giờ trước`;
  const d = Math.floor(h / 24);
  return t ? t('time.days_ago', '{{count}} ngày trước', { count: d }) : `${d} ngày trước`;
};
