/**
 * Parses and normalizes pagination query parameters.
 * Eliminates the repeated parseInt + skip calculation across all services.
 * @param {number|string} page
 * @param {number|string} per_page
 * @returns {{ pageNumber: number, limitNumber: number, skip: number }}
 */
export const parsePagination = (page = 1, per_page = 10) => {
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(per_page, 10);
  const skip = (pageNumber - 1) * limitNumber;
  return { pageNumber, limitNumber, skip };
};

/**
 * Builds a Mongoose sort option object.
 * @param {string} order - 'asc' or 'desc'
 * @param {string} [field='createdAt']
 * @returns {Object}
 */
export const buildSortOption = (order, field = 'createdAt') => {
  return { [field]: order === 'asc' ? 1 : -1 };
};

export const formatPagination = (data, total, page, perPage, baseUrl = '') => {
  const lastPage = Math.ceil(total / perPage);
  const from = total > 0 ? (page - 1) * perPage + 1 : null;
  const to = total > 0 ? Math.min(page * perPage, total) : null;

  const buildUrl = (p) => p ? `${baseUrl}?page=${p}&per_page=${perPage}` : null;

  const links = [];
  
  // Previous link
  links.push({
    url: page > 1 ? buildUrl(page - 1) : null,
    label: "&laquo; Previous",
    page: page > 1 ? page - 1 : null,
    active: false
  });

  // Page links (simplified)
  for (let i = 1; i <= lastPage; i++) {
    links.push({
      url: buildUrl(i),
      label: String(i),
      page: i,
      active: i === page
    });
  }

  // Next link
  links.push({
    url: page < lastPage ? buildUrl(page + 1) : null,
    label: "Next &raquo;",
    page: page < lastPage ? page + 1 : null,
    active: false
  });

  return {
    data,
    pagination: {
      current_page: page,
      first_page_url: buildUrl(1),
      from,
      last_page: lastPage,
      last_page_url: buildUrl(lastPage),
      links,
      next_page_url: page < lastPage ? buildUrl(page + 1) : null,
      path: baseUrl,
      per_page: perPage,
      prev_page_url: page > 1 ? buildUrl(page - 1) : null,
      to,
      total
    }
  };
};
