export const lambdaHandler = async () => {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "Appointments retrieved successfully",
      appointments: []
    })
  };
};
