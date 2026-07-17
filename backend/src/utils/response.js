export const successResponse = (res, data, message = 'Success', statusCode = 200) => {
  const response = {
    status: 'success',
    message,
    data
  };
  return res.status(statusCode).json(response);
};

export const errorResponse = (res, message = 'Error', error = null, statusCode = 500) => {
  const response = {
    status: 'error',
    message,
    error
  };
  return res.status(statusCode).json(response);
};

export const paginatedResponse = (res, data, total, page, limit, message = 'Success', statusCode = 200) => {
  const response = {
    status: 'success',
    message,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
  return res.status(statusCode).json(response);
};
