
const getLastWeekId = () => {
  const now = new Date();
  now.setDate(now.getDate() - 7); // Move back one week
  const year = now.getFullYear();
  const week = Math.ceil((((now - new Date(year, 0, 1)) / 86400000) + new Date(year, 0, 1).getDay() + 1) / 7);
  return `${year}-${String(week).padStart(2, "0")}`;
};

const getCurrentWeekId = () => {
  const now = new Date();
  const year = now.getFullYear();
  const week = Math.ceil((((now - new Date(year, 0, 1)) / 86400000) + new Date(year, 0, 1).getDay() + 1) / 7);
  return `${year}-${String(week).padStart(2, "0")}`;
};


const isNewWeek = (updatedAt) => {
  const now = new Date();
  const lastDate = new Date(updatedAt);

  const lastWeek = getWeekNumber(lastDate);
  const currentWeek = getWeekNumber(now);

  const lastYear = lastDate.getFullYear();
  const currentYear = now.getFullYear();

  // Only reset on Monday, and only if it's a new week
  return now.getDay() === 1 && (currentYear !== lastYear || currentWeek !== lastWeek);
};

const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // Move to nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
};


module.exports = {isNewWeek,getLastWeekId,getCurrentWeekId}
