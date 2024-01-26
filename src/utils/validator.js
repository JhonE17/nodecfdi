export const validDate = (dateStart, dateEnd) => {
  if (!dateStart || !dateEnd || dateStart.trim() === '' || dateEnd.trim() === '') {
    throw new Error('Ambas fechas son requeridas y no pueden ser vacías o nulas.');
  }
};
