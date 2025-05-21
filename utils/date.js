const { format } = require('date-fns');
const { id } = require('date-fns/locale');


function formatReadableDate(date) {
  if (!date) return '-';
  try {
    return format(new Date(date), 'dd MMMM yyyy HH:mm', { locale: id });
  } catch (err) {
    console.error('Date format error:', err);
    return String(date); // fallback
  }
}

module.exports = {
  formatReadableDate,
};
