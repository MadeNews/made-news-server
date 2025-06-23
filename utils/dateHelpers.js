
const getLastWeekDate = () => {
  const now = new Date();
  now.setDate(now.getDate() - 7); // Move back one week
  const year = now.getFullYear();
  const week = Math.ceil((((now - new Date(year, 0, 1)) / 86400000) + new Date(year, 0, 1).getDay() + 1) / 7);
  return `${year}-${String(week).padStart(2, "0")}`;
};

const isNewWeek = (updatedAt) => {
  const lastDate = new Date(updatedAt);
  console.log(lastDate)
  const now = new Date();
  const lastWeek = getWeekNumber(lastDate);
  const currentWeek = getWeekNumber(now);
  return currentWeek !== lastWeek || now.getFullYear() !== lastDate.getFullYear();
};

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

module.exports = {isNewWeek,getLastWeekDate}
