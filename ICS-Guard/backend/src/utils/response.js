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

export const paginatedResponse = (res, data, pagination, message = 'Success', statusCode = 200) => {
  const response = {
    status: 'success',
    message,
    data,
    pagination
  };
  return res.status(statusCode).json(response);
};
