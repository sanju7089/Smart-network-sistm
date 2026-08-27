const payments = [];

export function getPayments(req, res) {
  const userId = req.user?.id;

  const data = userId
    ? payments.filter((payment) => payment.userId === userId)
    : payments;

  res.json({
    success: true,
    data
  });
}

export function getPaymentById(req, res) {
  const payment = payments.find(
    (item) => item.id === req.params.id
  );

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: "Payment not found."
    });
  }

  res.json({
    success: true,
    data: payment
  });
}

export function createPayment(req, res) {
  const { amount, bookingId, method } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid payment amount is required."
    });
  }

  const payment = {
    id: Date.now().toString(),
    userId: req.user?.id || null,
    bookingId: bookingId || null,
    amount: Number(amount),
    method: method || "pending",
    status: "pending",
    createdAt: new Date().toISOString()
  };

  payments.unshift(payment);

  res.status(201).json({
    success: true,
    message: "Payment record created successfully.",
    data: payment
  });
}

export function updatePaymentStatus(req, res) {
  const payment = payments.find(
    (item) => item.id === req.params.id
  );

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: "Payment not found."
    });
  }

  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Payment status is required."
    });
  }

  payment.status = status;
  payment.updatedAt = new Date().toISOString();

  res.json({
    success: true,
    message: "Payment status updated successfully.",
    data: payment
  });
}
