export const validDate = (dateStart, dateEnd) => {
  if (!dateStart || !dateEnd || dateStart.trim() === '' || dateEnd.trim() === '') {
    return false;
  }
};
